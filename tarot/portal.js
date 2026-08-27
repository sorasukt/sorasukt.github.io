(() => {
  const API = "https://api.sorasukt.com";
  const $ = id => document.getElementById(id);
  const returnTo = window.location.href;

  async function api(path, options={}) {
    return fetch(`${API}${path}`, {...options, credentials:"include"});
  }

  function initNavigation(){
    const header=document.querySelector('.portal-header');
    const nav=header?.querySelector('.portal-nav');
    if(!header||!nav||header.querySelector('.portal-menu-toggle'))return;

    if(!nav.id)nav.id='portalNavigation';
    const button=document.createElement('button');
    button.type='button';
    button.className='portal-menu-toggle';
    button.setAttribute('aria-label','เปิดเมนู');
    button.setAttribute('aria-controls',nav.id);
    button.setAttribute('aria-expanded','false');
    button.innerHTML='<span></span><span></span><span></span>';

    const account=header.querySelector('.portal-account');
    header.insertBefore(button,account||nav);

    const close=()=>{
      header.classList.remove('menu-open');
      button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-label','เปิดเมนู');
      document.body.classList.remove('portal-menu-lock');
    };

    button.addEventListener('click',()=>{
      const open=!header.classList.contains('menu-open');
      header.classList.toggle('menu-open',open);
      button.setAttribute('aria-expanded',String(open));
      button.setAttribute('aria-label',open?'ปิดเมนู':'เปิดเมนู');
      document.body.classList.toggle('portal-menu-lock',open&&matchMedia('(max-width: 820px)').matches);
    });

    nav.addEventListener('click',event=>{
      if(event.target.closest('a'))close();
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    addEventListener('resize',()=>{if(innerWidth>820)close();});
  }

  async function initAccount(){
    const signIn=$("portalSignIn"), me=$("portalMe"), logout=$("portalLogout");
    if(!signIn&&!me&&!logout)return;
    try{
      const r=await api("/api/member/me");
      const ok=r.ok;
      if(signIn){
        signIn.hidden=ok;
        signIn.onclick=()=>location.assign(`${API}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      }
      if(me)me.hidden=!ok;
      if(logout){
        logout.hidden=!ok;
        logout.onclick=()=>location.assign(`${API}/auth/logout?returnTo=${encodeURIComponent(location.origin+"/tarot/")}`);
      }
    }catch{
      if(signIn)signIn.hidden=false;
    }
  }

  window.TarotPortal={api};
  addEventListener("DOMContentLoaded",()=>{
    initNavigation();
    initAccount();
  });
})();
