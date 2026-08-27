import tarotWorker from "./index.js";
import {handleMember} from "./member.js";
import {handleAuthRoute,getSession} from "./auth-web.js";

const MAJOR=["The Fool","The Magician","The High Priestess","The Empress","The Emperor","The Hierophant","The Lovers","The Chariot","Strength","The Hermit","Wheel of Fortune","Justice","The Hanged Man","Death","Temperance","The Devil","The Tower","The Star","The Moon","The Sun","Judgement","The World"];
const RANKS=["Ace","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Page","Knight","Queen","King"];
const SUITS=["Wands","Cups","Swords","Pentacles"];
const DECK=[...MAJOR.map((name,id)=>({id,name,arcana:"major",suit:null})),...SUITS.flatMap((suit,s)=>RANKS.map((rank,r)=>({id:22+s*14+r,name:`${rank} of ${suit}`,arcana:"minor",suit:suit.toLowerCase()})))];

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);

    if(url.pathname.startsWith("/auth/")){
      try{
        const response=await handleAuthRoute(request,env);
        return response||json({success:false,error:{code:"NOT_FOUND",message:"Not found"}},404,baseHeaders(request,env));
      }catch(error){
        console.error("Auth route failed",error?.message||"error");
        return json({success:false,error:{code:"AUTH_CONFIG_ERROR",message:"Authentication service is not configured"}},500,baseHeaders(request,env));
      }
    }

    if(!url.pathname.startsWith("/api/member/"))return tarotWorker.fetch(request,env,ctx);

    const headers=baseHeaders(request,env);
    const origin=request.headers.get("Origin")||"";
    const corsOrigin=headers.get("Access-Control-Allow-Origin")||"";
    if(request.method==="OPTIONS"){
      if(!corsOrigin)return new Response(null,{status:403});
      return new Response(null,{status:204,headers:{...Object.fromEntries(headers),"Access-Control-Allow-Methods":"GET, PUT, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Credentials":"true","Access-Control-Max-Age":"86400"}});
    }
    if(origin&&!corsOrigin)return json({success:false,error:{code:"ORIGIN_NOT_ALLOWED",message:"Origin not allowed"}},403,headers);

    const session=await getSession(request,env);
    if(!session)return json({success:false,error:{code:"UNAUTHORIZED",message:"Authentication required"}},401,headers);
    const auth={ok:true,payload:session};

    if(url.pathname==="/api/member/me"){
      if(request.method!=="GET")return json({success:false,error:{code:"METHOD_NOT_ALLOWED",message:"Method not allowed"}},405,headers);
      const {sub,name,nickname,email,picture}=session;
      return json({success:true,user:{sub,name,nickname,email,picture}},200,headers);
    }

    const response=await handleMember(request,env,headers,auth,DECK);
    return response||json({success:false,error:{code:"NOT_FOUND",message:"Not found"}},404,headers);
  }
};

function baseHeaders(request,env){
  const origin=request.headers.get("Origin")||"";
  const allowed=(env.ALLOWED_ORIGINS||"https://sorasukt.com,https://www.sorasukt.com").split(",").map(x=>x.trim()).filter(Boolean);
  const corsOrigin=allowed.includes(origin)?origin:"";
  return new Headers({
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "Vary":"Origin",
    ...(corsOrigin?{"Access-Control-Allow-Origin":corsOrigin,"Access-Control-Allow-Credentials":"true"}:{})
  });
}

function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers})}
