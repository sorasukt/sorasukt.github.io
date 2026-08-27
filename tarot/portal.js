(() => {
  const API = "https://api.sorasukt.com";
  const $ = id => document.getElementById(id);
  const returnTo = window.location.href;
  async function api(path, options={}) { return fetch(`${API}${path}`, {...options, credentials:"include"}); }

  function initNavigation(){
    const header=document.querySelector('.portal-header');
    const nav=header?.querySelector('.portal-nav');
    const account=header?.querySelector('.portal-account');
    if(!header||!nav||header.querySelector('.portal-menu-toggle'))return;
    if(!nav.id)nav.id='portalNavigation';

    const accountPlaceholder=document.createComment('portal-account-placeholder');
    if(account)account.parentNode.insertBefore(accountPlaceholder,account);

    const button=document.createElement('button');
    button.type='button';
    button.className='portal-menu-toggle';
    button.setAttribute('aria-label','เปิดเมนู');
    button.setAttribute('aria-controls',nav.id);
    button.setAttribute('aria-expanded','false');
    button.innerHTML='<span></span><span></span><span></span>';
    header.insertBefore(button,account||nav);

    const syncAccountPlacement=()=>{
      if(!account)return;
      if(matchMedia('(max-width: 820px)').matches){
        if(account.parentNode!==nav){account.classList.add('portal-account-mobile');nav.append(account);}
      }else{
        account.classList.remove('portal-account-mobile');
        if(account.parentNode===nav)accountPlaceholder.parentNode.insertBefore(account,accountPlaceholder.nextSibling);
      }
    };

    const close=()=>{
      header.classList.remove('menu-open');
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-label','เปิดเมนู');
      document.body.classList.remove('portal-menu-lock');
    };

    button.addEventListener('click',()=>{
      syncAccountPlacement();
      const open=!header.classList.contains('menu-open');
      header.classList.toggle('menu-open',open);
      button.setAttribute('aria-expanded',String(open));
      button.setAttribute('aria-label',open?'ปิดเมนู':'เปิดเมนู');
      document.body.classList.toggle('portal-menu-lock',open&&matchMedia('(max-width: 820px)').matches);
    });
    nav.addEventListener('click',e=>{if(e.target.closest('a,button'))close();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    addEventListener('resize',()=>{syncAccountPlacement();if(innerWidth>820)close();});
    syncAccountPlacement();
  }

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
  addEventListener("DOMContentLoaded",()=>{initNavigation();initAccount();});
})();
