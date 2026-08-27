(() => {
  const AUTH0_DOMAIN = "auth.sorasukt.com";
  const AUTH0_CLIENT_ID = "NbMkuqqsuljnBKcAKVDr8bICryQZR4MI";
  const AUTH0_AUDIENCE = "https://api.sorasukt.com";
  const AUTH0_SCOPE = "openid profile email";
  const API = "https://api.sorasukt.com";
  const REDIRECT_URI = `${window.location.origin}/tarot/`;
  const $ = id => document.getElementById(id);
  let authClient = null;

  function getAuthClient(){
    if(authClient)return authClient;
    if(!window.auth0 || typeof window.auth0.Auth0Client !== "function"){
      throw new Error("Auth0 SPA SDK failed to load");
    }
    authClient = new window.auth0.Auth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      cacheLocation: "localstorage",
      authorizationParams: {
        redirect_uri: REDIRECT_URI,
        audience: AUTH0_AUDIENCE,
        scope: AUTH0_SCOPE
      }
    });
    return authClient;
  }

  async function initAuth(){
    const auth = getAuthClient();
    const params = new URLSearchParams(window.location.search);
    if(params.has("code") && params.has("state")){
      await auth.handleRedirectCallback();
      window.history.replaceState({}, document.title, "/tarot/");
    }
    return auth;
  }

  async function login(){
    return getAuthClient().loginWithRedirect({
      authorizationParams: { redirect_uri: REDIRECT_URI },
      appState: { returnTo: "/tarot/" }
    });
  }

  async function logout(){
    return getAuthClient().logout({
      logoutParams: { returnTo: REDIRECT_URI }
    });
  }

  async function authorizedFetch(input, options={}){
    const token = await getAuthClient().getTokenSilently();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, {...options, headers});
  }

  async function init(){
    const auth = await initAuth();
    const authenticated = await auth.isAuthenticated();
    $("signInButton").hidden = authenticated;
    $("logoutButton").hidden = !authenticated;
    $("userButton").hidden = !authenticated;
    $("memberPanel").hidden = !authenticated;
    if(!authenticated)return;

    const user = await auth.getUser();
    $("userName").textContent = user?.name || user?.nickname || user?.email || "บัญชี";
    if(user?.picture){
      $("userAvatar").src = user.picture;
      $("userAvatar").alt = $("userName").textContent;
      $("userAvatar").hidden = false;
    }
    await loadProfileAndDaily();
  }

  async function api(path, options={}){
    return authorizedFetch(`${API}${path}`, options);
  }

  function showAuthError(message){
    console.error(message);
    window.alert(message);
  }

  async function runAuthAction(action, button, label){
    const original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    setStatus("");
    try{
      await action();
    }catch(error){
      console.error("Auth action failed", error);
      const message = `ไม่สามารถเปิดระบบลงชื่อเข้าใช้ได้\n\n${error?.message || "Unknown authentication error"}`;
      setStatus(message);
      showAuthError(message);
      button.disabled = false;
      button.textContent = original;
    }
  }

  async function loadProfileAndDaily(){
    setStatus("กำลังโหลดข้อมูลสมาชิก...");
    const response = await api("/api/member/profile");
    const data = await response.json();
    if(!response.ok)throw new Error(data?.error?.message || "โหลดโปรไฟล์ไม่สำเร็จ");
    if(!data.profile){
      $("profileForm").hidden = false;
      $("dailyContent").hidden = true;
      setStatus("ระบุวันเดือนปีเกิดเพื่อเปิดใช้งานดวงประจำวัน");
      return;
    }
    $("birthDate").value = data.profile.birth_date || "";
    $("birthTime").value = data.profile.birth_time || "";
    $("profileForm").hidden = true;
    await loadDaily();
  }

  async function loadDaily(){
    $("dailyContent").hidden = true;
    setStatus("กำลังเปิดดวงประจำวันของคุณ...");
    let response = await api("/api/member/daily");
    if(response.status === 202){
      await new Promise(r => setTimeout(r, 1800));
      response = await api("/api/member/daily");
    }
    const data = await response.json();
    if(response.status === 409 && data?.error?.code === "PROFILE_REQUIRED"){
      $("profileForm").hidden = false;
      setStatus(data.error.message);
      return;
    }
    if(!response.ok){
      setStatus(data?.error?.message || "ไม่สามารถโหลดดวงประจำวันได้");
      return;
    }
    $("dailyDate").textContent = data.date;
    $("dailyCard").textContent = data.card?.name || "";
    $("dailyTitle").textContent = data.horoscope?.title || "ดวงประจำวัน";
    $("dailySummary").textContent = data.horoscope?.summary || "";
    $("dailyEnergy").textContent = data.horoscope?.energy || "";
    $("dailyFocus").textContent = data.horoscope?.focus || "";
    $("dailyAvoid").textContent = data.horoscope?.avoid || "";
    $("dailyAdvice").textContent = data.horoscope?.advice || "";
    $("dailyContent").hidden = false;
    setStatus(data.cached ? "ดวงวันนี้ถูกบันทึกไว้แล้ว จะรีเซ็ตเมื่อเข้าสู่วันใหม่ตามเวลาไทย" : "สร้างดวงวันนี้เรียบร้อยแล้ว");
  }

  async function saveProfile(event){
    event.preventDefault();
    const birthDate = $("birthDate").value;
    const birthTime = $("birthTime").value;
    if(!birthDate){
      setStatus("กรุณาระบุวันเดือนปีเกิด");
      return;
    }
    $("saveProfile").disabled = true;
    try{
      const response = await api("/api/member/profile", {
        method: "PUT",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({birthDate, birthTime})
      });
      const data = await response.json();
      if(!response.ok)throw new Error(data?.error?.message || "บันทึกข้อมูลไม่สำเร็จ");
      $("profileForm").hidden = true;
      await loadDaily();
    }catch(error){
      setStatus(error.message);
    }finally{
      $("saveProfile").disabled = false;
    }
  }

  function setStatus(text){
    $("memberStatus").textContent = text || "";
  }

  window.addEventListener("DOMContentLoaded", () => {
    const signInButton = $("signInButton");
    const logoutButton = $("logoutButton");
    signInButton.addEventListener("click", () => runAuthAction(login, signInButton, "กำลังเปิดหน้าลงชื่อเข้าใช้…"));
    logoutButton.addEventListener("click", () => runAuthAction(logout, logoutButton, "กำลังออกจากระบบ…"));
    $("profileForm").addEventListener("submit", saveProfile);
    $("editProfile").addEventListener("click", () => { $("profileForm").hidden = false; });
    init().catch(error => {
      console.error("Member initialization failed", error);
      const message = `ไม่สามารถโหลดระบบสมาชิกได้: ${error?.message || "Unknown error"}`;
      setStatus(message);
    });
  });
})();
