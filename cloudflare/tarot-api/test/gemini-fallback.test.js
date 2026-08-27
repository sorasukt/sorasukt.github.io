import assert from "node:assert/strict";
import test from "node:test";
import {capacityError,generateGeminiJson,GeminiCapacityError,geminiModelChain} from "../src/gemini.js";

const options={system:"system",prompt:"prompt",schema:{type:"object"},timeoutMs:1000};
const success=()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({title:"ready"})}]}}]}),{status:200,headers:{"Content-Type":"application/json"}});

test("429 falls back through the requested Gemini model order",async()=>{
  const originalFetch=globalThis.fetch;
  const models=[];
  globalThis.fetch=async url=>{
    models.push(new URL(url).pathname.match(/models\/([^:]+)/)?.[1]);
    return models.length<3?new Response(null,{status:429}):success();
  };
  try{
    const generated=await generateGeminiJson({GEMINI_API_KEY:"test",GEMINI_MODEL:"gemini-3.6-flash"},options);
    assert.deepEqual(models,["gemini-3.6-flash","gemini-2.5-flash","gemini-2.5-flash-lite"]);
    assert.deepEqual(generated.result,{title:"ready"});
    assert.equal(generated.model,"gemini-2.5-flash-lite");
  }finally{globalThis.fetch=originalFetch}
});

test("Gemini 3.5 Flash is the final fallback and exhaustion is explicit",async()=>{
  const originalFetch=globalThis.fetch;
  const models=[];
  globalThis.fetch=async url=>{models.push(new URL(url).pathname.match(/models\/([^:]+)/)?.[1]);return new Response(null,{status:429})};
  try{
    await assert.rejects(generateGeminiJson({GEMINI_API_KEY:"test",GEMINI_MODEL:"gemini-3.6-flash"},options),GeminiCapacityError);
    assert.deepEqual(models,["gemini-3.6-flash","gemini-2.5-flash","gemini-2.5-flash-lite","gemini-3.5-flash"]);
  }finally{globalThis.fetch=originalFetch}
});

test("non-429 upstream errors do not consume fallback capacity",async()=>{
  const originalFetch=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async()=>{requests+=1;return new Response(null,{status:500})};
  try{await assert.rejects(generateGeminiJson({GEMINI_API_KEY:"test"},options),/status 500/);assert.equal(requests,1)}
  finally{globalThis.fetch=originalFetch}
});

test("duplicate configured models are removed and capacity response includes Stripe support",()=>{
  assert.deepEqual(geminiModelChain({GEMINI_MODEL:"gemini-2.5-flash"}),["gemini-2.5-flash","gemini-2.5-flash-lite","gemini-3.5-flash"]);
  const error=capacityError({SUPPORT_URL:"https://buy.stripe.com/example"});
  assert.equal(error.code,"AI_CAPACITY_EXHAUSTED");
  assert.equal(error.supportUrl,"https://buy.stripe.com/example");
});
