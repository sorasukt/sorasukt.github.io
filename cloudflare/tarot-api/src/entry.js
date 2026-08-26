import tarotWorker from "./index.js";
import {handleMember} from "./member.js";

const MAJOR=["The Fool","The Magician","The High Priestess","The Empress","The Emperor","The Hierophant","The Lovers","The Chariot","Strength","The Hermit","Wheel of Fortune","Justice","The Hanged Man","Death","Temperance","The Devil","The Tower","The Star","The Moon","The Sun","Judgement","The World"];
const RANKS=["Ace","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Page","Knight","Queen","King"];
const SUITS=["Wands","Cups","Swords","Pentacles"];
const DECK=[...MAJOR.map((name,id)=>({id,name,arcana:"major",suit:null})),...SUITS.flatMap((suit,s)=>RANKS.map((rank,r)=>({id:22+s*14+r,name:`${rank} of ${suit}`,arcana:"minor",suit:suit.toLowerCase()})))];
let jwksCache={expiresAt:0,keys:[]};

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(!url.pathname.startsWith("/api/member/"))return tarotWorker.fetch(request,env,ctx);

    const origin=request.headers.get("Origin")||"";
    const allowed=(env.ALLOWED_ORIGINS||"https://sorasukt.com,https://www.sorasukt.com").split(",").map(x=>x.trim()).filter(Boolean);
    const corsOrigin=allowed.includes(origin)?origin:"";
    const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","Vary":"Origin",...(corsOrigin?{"Access-Control-Allow-Origin":corsOrigin}:{})};
    if(request.method==="OPTIONS"){
      if(!corsOrigin)return new Response(null,{status:403});
      return new Response(null,{status:204,headers:{...headers,"Access-Control-Allow-Methods":"GET, PUT, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Max-Age":"86400"}});
    }
    if(origin&&!corsOrigin)return json({success:false,error:{code:"ORIGIN_NOT_ALLOWED",message:"Origin not allowed"}},403,headers);

    if(url.pathname==="/api/member/me")return tarotWorker.fetch(request,env,ctx);
    const auth=await authenticate(request,env);
    if(!auth.ok)return json({success:false,error:{code:"UNAUTHORIZED",message:"Authentication required"}},401,headers);
    const response=await handleMember(request,env,headers,auth,DECK);
    return response||json({success:false,error:{code:"NOT_FOUND",message:"Not found"}},404,headers);
  }
};

async function authenticate(request,env){
  const header=request.headers.get("Authorization")||"";
  if(!header.startsWith("Bearer "))return {ok:false};
  const token=header.slice(7).trim(); const parts=token.split("."); if(parts.length!==3)return {ok:false};
  try{
    const jwtHeader=JSON.parse(decodeBase64Url(parts[0])); const payload=JSON.parse(decodeBase64Url(parts[1]));
    if(jwtHeader.alg!=="RS256"||!jwtHeader.kid)return {ok:false};
    const domain=(env.AUTH0_DOMAIN||"auth.sorasukt.com").replace(/^https?:\/\//,"").replace(/\/$/,"");
    const issuer=`https://${domain}/`; const audience=env.AUTH0_AUDIENCE||"https://api.sorasukt.com"; const now=Math.floor(Date.now()/1000);
    const audiences=Array.isArray(payload.aud)?payload.aud:[payload.aud];
    if(payload.iss!==issuer||!audiences.includes(audience)||!payload.sub||payload.exp<=now||(payload.nbf&&payload.nbf>now+60))return {ok:false};
    const keys=await getJwks(domain); const jwk=keys.find(key=>key.kid===jwtHeader.kid&&key.kty==="RSA"); if(!jwk)return {ok:false};
    const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
    const data=new TextEncoder().encode(`${parts[0]}.${parts[1]}`); const signature=base64UrlBytes(parts[2]);
    const valid=await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,signature,data);
    return valid?{ok:true,payload}:{ok:false};
  }catch{return {ok:false};}
}

async function getJwks(domain){
  if(Date.now()<jwksCache.expiresAt&&jwksCache.keys.length)return jwksCache.keys;
  const response=await fetch(`https://${domain}/.well-known/jwks.json`,{headers:{Accept:"application/json"}}); if(!response.ok)throw new Error("JWKS fetch failed");
  const body=await response.json(); jwksCache={keys:Array.isArray(body.keys)?body.keys:[],expiresAt:Date.now()+10*60*1000}; return jwksCache.keys;
}
function decodeBase64Url(value){return new TextDecoder().decode(base64UrlBytes(value))}
function base64UrlBytes(value){const base64=value.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-value.length%4)%4);const binary=atob(base64);const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers})}
