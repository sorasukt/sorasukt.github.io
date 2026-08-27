const DAILY_SCHEMA={type:"object",additionalProperties:false,required:["title","summary","energy","focus","avoid","advice"],properties:{title:{type:"string"},summary:{type:"string"},energy:{type:"string"},focus:{type:"string"},avoid:{type:"string"},advice:{type:"string"}}};

export async function handleMember(request,env,headers,auth,deck){
  const url=new URL(request.url);
  if(!env.DB)return json({success:false,error:{code:"STORAGE_NOT_CONFIGURED",message:"Member storage is not configured"}},503,headers);

  if(url.pathname==="/api/member/profile"){
    if(request.method==="GET")return getProfile(env,headers,auth.payload.sub);
    if(request.method==="PUT"||request.method==="POST")return saveProfile(request,env,headers,auth.payload.sub);
    return json({success:false,error:{code:"METHOD_NOT_ALLOWED",message:"Method not allowed"}},405,headers);
  }

  if(url.pathname==="/api/member/daily"){
    if(request.method!=="GET")return json({success:false,error:{code:"METHOD_NOT_ALLOWED",message:"Method not allowed"}},405,headers);
    return getDaily(env,headers,auth.payload.sub,deck);
  }

  return null;
}

async function getProfile(env,headers,sub){
  const profile=await env.DB.prepare("SELECT birth_date,birth_time,timezone,updated_at FROM member_profiles WHERE user_sub=?").bind(sub).first();
  return json({success:true,profile:profile||null},200,headers);
}

async function saveProfile(request,env,headers,sub){
  let body;
  try{
    const text=await request.text();
    body=JSON.parse(text);
  }catch{
    return json({success:false,error:{code:"INVALID_REQUEST",message:"Invalid JSON request"}},400,headers);
  }
  const birthDate=typeof body.birthDate==="string"?body.birthDate.trim():"";
  const birthTime=typeof body.birthTime==="string"?body.birthTime.trim():"";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)||Number.isNaN(Date.parse(`${birthDate}T00:00:00Z`)))return json({success:false,error:{code:"INVALID_BIRTH_DATE",message:"กรุณาระบุวันเดือนปีเกิดให้ถูกต้อง"}},400,headers);
  if(birthTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(birthTime))return json({success:false,error:{code:"INVALID_BIRTH_TIME",message:"เวลาเกิดไม่ถูกต้อง"}},400,headers);
  const today=new Date(); const born=new Date(`${birthDate}T00:00:00Z`); if(born>today)return json({success:false,error:{code:"INVALID_BIRTH_DATE",message:"วันเกิดต้องไม่อยู่ในอนาคต"}},400,headers);
  await env.DB.prepare(`INSERT INTO member_profiles(user_sub,birth_date,birth_time,timezone,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_sub) DO UPDATE SET birth_date=excluded.birth_date,birth_time=excluded.birth_time,timezone=excluded.timezone,updated_at=CURRENT_TIMESTAMP`)
    .bind(sub,birthDate,birthTime||null,"Asia/Bangkok").run();
  return json({success:true,profile:{birth_date:birthDate,birth_time:birthTime||null,timezone:"Asia/Bangkok"}},200,headers);
}

async function getDaily(env,headers,sub,deck){
  if(!env.GEMINI_API_KEY)return json({success:false,error:{code:"SERVER_CONFIG_ERROR",message:"AI service is not configured"}},500,headers);
  const profile=await env.DB.prepare("SELECT birth_date,birth_time FROM member_profiles WHERE user_sub=?").bind(sub).first();
  if(!profile)return json({success:false,error:{code:"PROFILE_REQUIRED",message:"กรุณาระบุวันเดือนปีเกิดก่อนดูดวงประจำวัน"}},409,headers);
  const day=bangkokDate();
  const cached=await env.DB.prepare("SELECT status,card_id,card_name,horoscope_json FROM daily_readings WHERE user_sub=? AND reading_date=?").bind(sub,day).first();
  if(cached?.status==="ready"&&cached.horoscope_json){
    try{
      return json({success:true,cached:true,date:day,card:{id:cached.card_id,name:cached.card_name},horoscope:JSON.parse(cached.horoscope_json)},200,headers);
    }catch{
      console.error("Cached daily reading contains invalid JSON");
      await env.DB.prepare("DELETE FROM daily_readings WHERE user_sub=? AND reading_date=?").bind(sub,day).run();
    }
  }
  if(cached?.status==="pending")return json({success:false,pending:true,error:{code:"DAILY_PENDING",message:"กำลังจัดทำดวงประจำวันของคุณ"}},202,headers);

  const cardId=await dailyCardId(`${sub}:${day}`,deck.length);
  const card=deck[cardId];
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO daily_readings(user_sub,reading_date,status,card_id,card_name,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)").bind(sub,day,"pending",card.id,card.name).run();
  if(!inserted.meta?.changes)return json({success:false,pending:true,error:{code:"DAILY_PENDING",message:"กำลังจัดทำดวงประจำวันของคุณ"}},202,headers);

  try{
    const horoscope=await generateDaily(env,{day,birthDate:profile.birth_date,birthTime:profile.birth_time,card});
    await env.DB.prepare("UPDATE daily_readings SET status='ready',horoscope_json=?,updated_at=CURRENT_TIMESTAMP WHERE user_sub=? AND reading_date=?").bind(JSON.stringify(horoscope),sub,day).run();
    return json({success:true,cached:false,date:day,card:{id:card.id,name:card.name},horoscope},200,headers);
  }catch(error){
    console.error("Daily reading generation failed",error?.name||"error");
    await env.DB.prepare("DELETE FROM daily_readings WHERE user_sub=? AND reading_date=? AND status='pending'").bind(sub,day).run();
    const timedOut=error?.name==="AbortError";
    return json({success:false,error:{code:timedOut?"AI_TIMEOUT":"AI_GENERATION_FAILED",message:"ไม่สามารถสร้างดวงประจำวันได้ในขณะนี้"}},timedOut?504:502,headers);
  }
}

async function generateDaily(env,{day,birthDate,birthTime,card}){
  const model=env.GEMINI_MODEL||"gemini-3.6-flash";
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const system="You create concise, grounded daily reflective horoscope guidance in natural Thai. Treat astrology and Tarot as reflective frameworks, not factual prediction. Never claim certainty. Avoid fear, medical/legal/financial directives, or deterministic statements.";
  const prompt=`Create today's personalized daily reflection for date ${day} in Thailand. Birth date: ${birthDate}. Birth time: ${birthTime||"not provided"}. Daily Tarot card: ${card.name}. Use the birth details only to personalize tone/themes; do not invent precise astronomical placements that were not calculated. Keep it useful and specific.`;
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseJsonSchema:DAILY_SCHEMA}}),signal:controller.signal});
    if(!response.ok)throw new Error("Gemini daily request failed");
    const raw=await response.json(); const text=raw?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
    const horoscope=JSON.parse(text);
    if(!horoscope||typeof horoscope!=="object")throw new Error("Gemini daily response is invalid");
    return horoscope;
  }finally{
    clearTimeout(timeout);
  }
}

function bangkokDate(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const value=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function dailyCardId(seed,length){
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(seed));
  const view=new DataView(bytes); return view.getUint32(0,false)%length;
}

function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers})}
