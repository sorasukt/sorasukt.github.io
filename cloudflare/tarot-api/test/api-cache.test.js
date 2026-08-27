import assert from "node:assert/strict";
import test from "node:test";
import tarotWorker from "../src/index.js";
import {handleFortune} from "../src/fortune.js";

function cachedDb(value){
  return {prepare(){return {bind(){return this},async first(){return {result_json:JSON.stringify(value)}}}}};
}

test("fortune endpoint returns a signed-in member cache hit without calling Gemini",async()=>{
  const originalFetch=globalThis.fetch;
  let geminiCalls=0;
  globalThis.fetch=async()=>{geminiCalls+=1;throw new Error("Gemini should not be called")};
  try{
    const saved={title:"ผลเดิม",summary:"saved",insights:["one","two"],reflection:"reflect"};
    const request=new Request("https://api.sorasukt.com/api/fortune/zodiac",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({birthDate:"2000-01-02"})});
    const response=await handleFortune(request,{DB:cachedDb(saved),GEMINI_API_KEY:"configured"},new Headers(),{sub:"auth0|member"},{birth_date:"2000-01-02"});
    const body=await response.json();
    assert.equal(response.status,200);
    assert.equal(body.cached,true);
    assert.deepEqual(body.result,saved);
    assert.equal(geminiCalls,0);
  }finally{globalThis.fetch=originalFetch}
});

test("Tarot endpoint returns the member cache hit before Gemini configuration",async()=>{
  const saved={readingTitle:"ผลเดิม",cards:[]};
  const request=new Request("https://api.sorasukt.com/api/tarot/reading",{method:"POST",headers:{Origin:"https://sorasukt.com","Content-Type":"application/json"},body:JSON.stringify({question:"วันนี้ควรโฟกัสอะไร",cards:[0,1,2,3,4].map(cardId=>({cardId,orientation:"upright"}))})});
  const response=await tarotWorker.fetch(request,{DB:cachedDb(saved),ALLOWED_ORIGINS:"https://sorasukt.com"},null,{session:{sub:"auth0|member"},profile:{birth_date:"2000-01-02"}});
  const body=await response.json();
  assert.equal(response.status,200);
  assert.equal(body.cached,true);
  assert.deepEqual(body.reading,saved);
});
