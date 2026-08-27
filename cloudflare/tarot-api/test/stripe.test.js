import assert from "node:assert/strict";
import test from "node:test";
import {handleBilling,handleStripeWebhook,verifyStripeSignature} from "../src/stripe.js";

const headers={"Content-Type":"application/json"};

async function signature(payload,secret,timestamp){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signed=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${timestamp}.${payload}`));
  return [...new Uint8Array(signed)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

test("Stripe webhook signature accepts the raw body and rejects tampering or stale events",async()=>{
  const payload=JSON.stringify({id:"evt_test",type:"ping",data:{object:{id:"obj"}}}),secret="whsec_test",now=1_800_000_000;
  const digest=await signature(payload,secret,now);
  assert.equal(await verifyStripeSignature(payload,`t=${now},v1=${digest}`,secret,now),true);
  assert.equal(await verifyStripeSignature(`${payload} `,`t=${now},v1=${digest}`,secret,now),false);
  assert.equal(await verifyStripeSignature(payload,`t=${now-301},v1=${await signature(payload,secret,now-301)}`,secret,now),false);
});

test("support Checkout uses THB, PromptPay, card, and a required Thailand shipping address",async()=>{
  const originalFetch=globalThis.fetch;let requestBody="";
  globalThis.fetch=async (url,options)=>{assert.equal(url,"https://api.stripe.com/v1/checkout/sessions");requestBody=options.body;return Response.json({id:"cs_test_support",url:"https://checkout.stripe.com/c/pay/test"})};
  try{
    const request=new Request("https://api.sorasukt.com/api/billing/checkout/support",{method:"POST",headers,body:JSON.stringify({amount:399,accepted:true,requestId:"123e4567-e89b-12d3-a456-426614174000"})});
    const response=await handleBilling(request,{STRIPE_SECRET_KEY:"sk_test"},headers);
    assert.equal(response.status,200);
    const params=new URLSearchParams(requestBody);
    assert.equal(params.get("line_items[0][price_data][currency]"),"thb");
    assert.equal(params.get("line_items[0][price_data][unit_amount]"),"39900");
    assert.deepEqual(params.getAll("payment_method_types[0]"),["card"]);
    assert.deepEqual(params.getAll("payment_method_types[1]"),["promptpay"]);
    assert.equal(params.get("billing_address_collection"),"required");
    assert.equal(params.get("shipping_address_collection[allowed_countries][0]"),"TH");
  }finally{globalThis.fetch=originalFetch}
});

test("membership Checkout selects only the server-configured Price ID",async()=>{
  const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{calls.push({url,body:options.body||""});if(url.endsWith("/prices/price_trusted"))return Response.json({id:"price_trusted",active:true,currency:"thb",unit_amount:25900});if(url.endsWith("/customers"))return Response.json({id:"cus_test_member"});return Response.json({id:"cs_test_member",url:"https://checkout.stripe.com/c/pay/member"})};
  const DB={prepare(sql){return {bind(){return this},async first(){return sql.includes("SELECT stripe_customer_id")?null:null},async run(){return {meta:{changes:1}}}}}};
  try{
    const request=new Request("https://api.sorasukt.com/api/billing/checkout/membership",{method:"POST",headers,body:JSON.stringify({period:"monthly",paymentType:"one_time",priceId:"price_attacker",requestId:"123e4567-e89b-12d3-a456-426614174001"})});
    const env={DB,STRIPE_SECRET_KEY:"sk_test",STRIPE_PRICE_ONETIME_MONTHLY:"price_trusted"};
    const session={sub:"auth0|member",email:"member@example.com",name:"Member"};
    const response=await handleBilling(request,env,headers,session);
    assert.equal(response.status,200);
    const checkout=new URLSearchParams(calls.at(-1).body);
    assert.equal(checkout.get("line_items[0][price]"),"price_trusted");
    assert.notEqual(checkout.get("line_items[0][price]"),"price_attacker");
    assert.equal(checkout.get("metadata[user_sub]"),session.sub);
  }finally{globalThis.fetch=originalFetch}
});

test("membership plans expose the confirmed THB prices",async()=>{
  const response=await handleBilling(new Request("https://api.sorasukt.com/api/billing/plans"),{STRIPE_SECRET_KEY:"sk_test"},headers);
  const data=await response.json(),prices=Object.fromEntries(data.plans.map(plan=>[`${plan.paymentType}:${plan.period}`,plan.amount]));
  assert.equal(response.status,200);
  assert.deepEqual(prices,{"subscription:weekly":5900,"one_time:weekly":7900,"subscription:monthly":19900,"one_time:monthly":25900,"subscription:yearly":169000,"one_time:yearly":179000});
});

test("verified Stripe events are claimed once before processing",async()=>{
  const secret="whsec_test",timestamp=Math.floor(Date.now()/1000),payload=JSON.stringify({id:"evt_once",type:"ping",data:{object:{id:"obj"}}}),digest=await signature(payload,secret,timestamp);
  const seen=new Set();
  const DB={prepare(sql){let values=[];return {bind(...bound){values=bound;return this},async run(){if(sql.startsWith("INSERT OR IGNORE")){if(seen.has(values[0]))return {meta:{changes:0}};seen.add(values[0]);return {meta:{changes:1}}}return {meta:{changes:1}}}}}};
  const makeRequest=()=>new Request("https://api.sorasukt.com/api/stripe/webhook",{method:"POST",headers:{"Stripe-Signature":`t=${timestamp},v1=${digest}`},body:payload});
  const first=await handleStripeWebhook(makeRequest(),{DB,STRIPE_WEBHOOK_SECRET:secret});
  const second=await handleStripeWebhook(makeRequest(),{DB,STRIPE_WEBHOOK_SECRET:secret});
  assert.equal(first.status,200);assert.equal((await first.json()).duplicate,undefined);
  assert.equal(second.status,200);assert.equal((await second.json()).duplicate,true);
});

test("a paid one-time membership is activated once by the verified webhook",async()=>{
  const secret="whsec_test",timestamp=Math.floor(Date.now()/1000);
  const event={id:"evt_membership_once",type:"checkout.session.completed",data:{object:{id:"cs_test_membership",payment_status:"paid",amount_total:29900,currency:"thb",customer:"cus_member",payment_intent:"pi_member",metadata:{kind:"membership",payment_type:"one_time",period:"monthly",user_sub:"auth0|member"}}}};
  const payload=JSON.stringify(event),digest=await signature(payload,secret,timestamp),seen=new Set(),membershipWrites=[];
  const DB={prepare(sql){let values=[];return {bind(...bound){values=bound;return this},async first(){return null},async run(){
    if(sql.startsWith("INSERT OR IGNORE")){if(seen.has(values[0]))return {meta:{changes:0}};seen.add(values[0]);return {meta:{changes:1}}}
    if(sql.includes("INSERT INTO tarot_memberships"))membershipWrites.push(values);
    return {meta:{changes:1}};
  }}}};
  const makeRequest=()=>new Request("https://api.sorasukt.com/api/stripe/webhook",{method:"POST",headers:{"Stripe-Signature":`t=${timestamp},v1=${digest}`},body:payload});
  assert.equal((await handleStripeWebhook(makeRequest(),{DB,STRIPE_WEBHOOK_SECRET:secret})).status,200);
  assert.equal((await handleStripeWebhook(makeRequest(),{DB,STRIPE_WEBHOOK_SECRET:secret})).status,200);
  assert.equal(membershipWrites.length,1);
  assert.deepEqual(membershipWrites[0].slice(0,5),["auth0|member","cus_member","monthly","one_time","active"]);
});
