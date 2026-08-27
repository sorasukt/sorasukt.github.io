const DEFAULT_MODEL="gemini-3.6-flash";
const RATE_LIMIT_FALLBACKS=["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-3.5-flash","gemini-3.1-flash-lite","gemini-3.5-flash-lite"];

export class GeminiCapacityError extends Error{
  constructor(){super("All Gemini model quotas are exhausted");this.name="GeminiCapacityError";this.code="AI_CAPACITY_EXHAUSTED"}
}

export class GeminiHttpError extends Error{
  constructor(status){super(`Gemini request failed with status ${status}`);this.name="GeminiHttpError";this.status=status}
}

export function geminiModelChain(env){
  return [...new Set([env.GEMINI_MODEL||DEFAULT_MODEL,...RATE_LIMIT_FALLBACKS])];
}

export function geminiCacheVersion(env){return geminiModelChain(env).join("|")}

export async function generateGeminiJson(env,{system,prompt,schema,maxOutputTokens=2048,timeoutMs=40000}){
  const models=geminiModelChain(env);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  const body=JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",responseJsonSchema:schema,maxOutputTokens}});
  try{
    for(let index=0;index<models.length;index+=1){
      const model=models[index];
      const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body,signal:controller.signal});
      if(response.status===429){
        if(response.body)await response.body.cancel().catch(()=>undefined);
        console.warn(JSON.stringify({message:"Gemini model quota exhausted",model,fallbackAvailable:index<models.length-1}));
        if(index===models.length-1)throw new GeminiCapacityError();
        continue;
      }
      if(!response.ok){
        if(response.body)await response.body.cancel().catch(()=>undefined);
        throw new GeminiHttpError(response.status);
      }
      const raw=await response.json();
      const text=raw?.candidates?.[0]?.content?.parts?.map(part=>part.text||"").join("")||"";
      const result=JSON.parse(text);
      if(!result||typeof result!=="object")throw new Error("Gemini response is invalid");
      if(index>0)console.log(JSON.stringify({message:"Gemini fallback succeeded",model,attempt:index+1}));
      return {result,model};
    }
    throw new GeminiCapacityError();
  }finally{clearTimeout(timeout)}
}

export function capacityError(env){
  return {code:"AI_CAPACITY_EXHAUSTED",message:"ขณะนี้มีผู้ใช้งานพร้อมกันจำนวนมาก ทำให้บริการประมวลผลครบขีดจำกัดชั่วคราว โปรดลองใหม่ภายหลัง หากต้องการช่วยให้เรารองรับผู้ใช้ได้มากขึ้น คุณสามารถสนับสนุนเราได้",supportUrl:env.SUPPORT_URL||"https://buy.stripe.com/5kQ8wOgsb6EI7yC1MWbjW00",supportLabel:"สนับสนุนการพัฒนาระบบ"};
}
