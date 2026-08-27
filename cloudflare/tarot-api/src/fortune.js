const RESULT_SCHEMA={type:"object",additionalProperties:false,required:["title","summary","insights","reflection"],properties:{title:{type:"string"},summary:{type:"string"},insights:{type:"array",minItems:2,maxItems:4,items:{type:"string"}},reflection:{type:"string"}}};
const NAMING_SCHEMA={type:"object",additionalProperties:false,required:["title","names","note"],properties:{title:{type:"string"},names:{type:"array",minItems:3,maxItems:6,items:{type:"object",additionalProperties:false,required:["name","meaning","tone"],properties:{name:{type:"string"},meaning:{type:"string"},tone:{type:"string"}}}},note:{type:"string"}}};

export async function handleFortune(request,env,headers,session=null,profile=null){
  const url=new URL(request.url);
  if(!url.pathname.startsWith('/api/fortune/'))return null;
  if(request.method!=="POST")return json({success:false,error:{code:"METHOD_NOT_ALLOWED",message:"Method not allowed"}},405,headers);
  if(!env.GEMINI_API_KEY)return json({success:false,error:{code:"SERVER_CONFIG_ERROR",message:"AI service is not configured"}},500,headers);
  let body;try{body=await request.json()}catch{return json({success:false,error:{code:"INVALID_REQUEST",message:"ข้อมูลคำขอไม่ถูกต้อง"}},400,headers)}
  const kind=url.pathname.slice('/api/fortune/'.length);
  try{
    if(kind==='zodiac')return zodiac(body,env,headers,session,profile);
    if(kind==='numbers')return numbers(body,env,headers,session,profile);
    if(kind==='naming')return naming(body,env,headers,session,profile);
    if(kind==='astrology')return astrology(body,env,headers,session,profile);
    return json({success:false,error:{code:"NOT_FOUND",message:"Not found"}},404,headers);
  }catch(error){
    const timeout=error?.name==='AbortError';
    console.error('Fortune API failed',kind,error?.name||error?.message||'error');
    return json({success:false,error:{code:timeout?'AI_TIMEOUT':'AI_GENERATION_FAILED',message:timeout?'ใช้เวลาประมวลผลนานเกินไป กรุณาลองใหม่':'ไม่สามารถสร้างผลลัพธ์ได้ในขณะนี้'}},timeout?504:502,headers);
  }
}

async function zodiac(body,env,headers,session,profile){
  const birthDate=validDate(body.birthDate)||profile?.birth_date;
  if(!birthDate)return json({success:false,error:{code:'INVALID_BIRTH_DATE',message:'กรุณาระบุวันเดือนปีเกิด'}},400,headers);
  const context=memberContext(session,profile);
  const prompt=`Create a concise zodiac-inspired reflective reading in natural Thai for birth date ${birthDate}. ${context} Explain the sun-sign theme without presenting personality as fixed or fate as certain. Give practical reflective insights for everyday life.`;
  const result=await generate(env,"You provide grounded zodiac-inspired reflection for entertainment and self-reflection. Never claim certainty or supernatural fact.",prompt,RESULT_SCHEMA);
  return json({success:true,result},200,headers);
}

async function astrology(body,env,headers,session,profile){
  const birthDate=validDate(body.birthDate)||profile?.birth_date;
  if(!birthDate)return json({success:false,error:{code:'INVALID_BIRTH_DATE',message:'กรุณาระบุวันเดือนปีเกิด'}},400,headers);
  const suppliedTime=typeof body.birthTime==='string'?body.birthTime.trim():'';
  const birthTime=suppliedTime||profile?.birth_time||'';
  const context=memberContext(session,profile);
  const prompt=`Create a grounded astrology-inspired overview in natural Thai using birth date ${birthDate}${birthTime?`, birth time ${birthTime}`:''}. ${context} Do not invent exact planets, houses, ascendant, aspects, or astronomical positions because no ephemeris calculation is provided. Focus on reflective themes, strengths, tensions, and one useful reflection question.`;
  const result=await generate(env,"You provide astrology-inspired reflection, never fabricated astronomical calculations and never deterministic predictions.",prompt,RESULT_SCHEMA);
  return json({success:true,result},200,headers);
}

async function numbers(body,env,headers,session,profile){
  const type=['phone','vehicle','house'].includes(body.type)?body.type:'general';
  const value=typeof body.value==='string'?body.value.trim():'';
  if(!value||value.length>80)return json({success:false,error:{code:'INVALID_VALUE',message:'กรุณาระบุข้อมูลตัวเลขที่ต้องการวิเคราะห์'}},400,headers);
  const digits=(value.match(/\d/g)||[]).join('');
  if(!digits)return json({success:false,error:{code:'INVALID_VALUE',message:'ไม่พบตัวเลขสำหรับการวิเคราะห์'}},400,headers);
  const context=memberContext(session,profile);
  const prompt=`Create a concise numerology-style reflective interpretation in natural Thai. Type: ${type}. User value: ${value}. Digits: ${digits}. ${context} Discuss symbolic themes only. Do not imply guaranteed luck, financial outcomes, safety, legal effects, or objective predictive power.`;
  const result=await generate(env,"You provide numerology-inspired symbolic reflection for entertainment. Be specific but never deterministic.",prompt,RESULT_SCHEMA);
  return json({success:true,result},200,headers);
}

async function naming(body,env,headers,session,profile){
  const tone=['calm','bright','strong','creative'].includes(body.tone)?body.tone:'calm';
  const seed=typeof body.seed==='string'?body.seed.trim().slice(0,40):'';
  const purpose=typeof body.purpose==='string'?body.purpose.trim().slice(0,80):'';
  const context=memberContext(session,profile);
  const prompt=`Suggest 5 original name ideas in natural Thai or internationally readable style. Desired tone: ${tone}. Seed or preferred sound: ${seed||'none'}. Purpose/context: ${purpose||'general personal naming'}. ${context} Explain each name briefly. Avoid claims that a name guarantees luck, wealth, health, relationships, or destiny. Do not imitate trademarks or famous people.`;
  const result=await generate(env,"You are a thoughtful naming assistant using symbolic and linguistic inspiration. Names are suggestions, not deterministic fortune claims.",prompt,NAMING_SCHEMA);
  return json({success:true,result},200,headers);
}

function memberContext(session,profile){
  if(!session)return 'The user is not signed in; use only the submitted input.';
  const bits=[];
  if(profile?.birth_date)bits.push(`saved birth date ${profile.birth_date}`);
  if(profile?.birth_time)bits.push(`saved birth time ${profile.birth_time}`);
  if(profile?.birth_place)bits.push(`saved birth place ${profile.birth_place}`);
  return bits.length?`The signed-in member also has ${bits.join(', ')}; use this only as secondary context when relevant.`:'The user is signed in but has no additional saved birth profile context.';
}
function validDate(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return '';const d=new Date(`${v}T00:00:00Z`);return Number.isNaN(d.valueOf())||d>new Date()?'':v;}
async function generate(env,system,prompt,schema){
  const model=env.GEMINI_MODEL||'gemini-3.6-flash';
  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',responseJsonSchema:schema}}),signal:controller.signal});
    if(!response.ok){console.error('Gemini fortune request failed',response.status);throw new Error('Gemini request failed');}
    const raw=await response.json();
    const text=raw?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    const result=JSON.parse(text);
    if(!result||typeof result!=='object')throw new Error('Invalid Gemini result');
    return result;
  }finally{clearTimeout(timeout)}
}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers})}
