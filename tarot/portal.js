(() => {
  const API = "https://api.sorasukt.com";
  const $ = id => document.getElementById(id);
  const returnTo = window.location.href;
  async function api(path, options={}) { return fetch(`${API}${path}`, {...options, credentials:"include"}); }
  async function initAccount(){
    const signIn=$("portalSignIn"), me=$("portalMe"), logout=$("portalLogout");
    if(!signIn&&!me&&!logout)return;
    try{
      const r=await api("/api/member/me");
      const ok=r.ok;
      if(signIn){ signIn.hidden=ok; signIn.onclick=()=>location.assign(`${API}/auth/login?returnTo=${encodeURIComponent(returnTo)}`); }
      if(me)me.hidden=!ok;
      if(logout){ logout.hidden=!ok; logout.onclick=()=>location.assign(`${API}/auth/logout?returnTo=${encodeURIComponent(location.origin+"/tarot/")}`); }
    }catch{ if(signIn)signIn.hidden=false; }
  }
  window.TarotPortal={api};
  addEventListener("DOMContentLoaded",initAccount);
})();
