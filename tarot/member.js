(() => {
  const AUTH0_DOMAIN = "auth.sorasukt.com";
  const AUTH0_CLIENT_ID = "NbMkuqqsuljnBKcAKVDr8bICryQZR4MI";
  const AUTH0_AUDIENCE = "https://api.sorasukt.com";
  const API = "https://api.sorasukt.com";
  const REDIRECT_URI = `${window.location.origin}/tarot/`;
  const $ = id => document.getElementById(id);

  let auth0Client;

  async function configureAuth0() {
    if (!window.auth0 || typeof window.auth0.createAuth0Client !== "function") {
      throw new Error("Auth0 SPA SDK failed to load");
    }

    auth0Client = await window.auth0.createAuth0Client({
      domain: AUTH0_DOMAIN,
      clientId: AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: REDIRECT_URI,
        audience: AUTH0_AUDIENCE,
        scope: "openid profile email"
      }
    });
  }

  async function handleAuth0Callback() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("code") || !params.has("state")) return;

    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, "/tarot/");
  }

  async function login() {
    await auth0Client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: REDIRECT_URI
      }
    });
  }

  async function logout() {
    auth0Client.logout({
      logoutParams: {
        returnTo: REDIRECT_URI
      }
    });
  }

  async function authorizedFetch(path, options = {}) {
    const token = await auth0Client.getTokenSilently();
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    return fetch(`${API}${path}`, {
      ...options,
      headers
    });
  }

  async function updateAuthUI() {
    const authenticated = await auth0Client.isAuthenticated();

    $("signInButton").hidden = authenticated;
    $("logoutButton").hidden = !authenticated;
    $("userButton").hidden = !authenticated;
    $("memberPanel").hidden = !authenticated;

    if (!authenticated) return false;

    const user = await auth0Client.getUser();
    $("userName").textContent = user?.name || user?.nickname || user?.email || "บัญชี";

    if (user?.picture) {
      $("userAvatar").src = user.picture;
      $("userAvatar").alt = $("userName").textContent;
      $("userAvatar").hidden = false;
    }

    return true;
  }

  async function init() {
    await configureAuth0();
    await handleAuth0Callback();

    const authenticated = await updateAuthUI();
    if (authenticated) {
      await loadProfileAndDaily();
    }
  }

  async function loadProfileAndDaily() {
    setStatus("กำลังโหลดข้อมูลสมาชิก...");
    const response = await authorizedFetch("/api/member/profile");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "โหลดโปรไฟล์ไม่สำเร็จ");
    }

    if (!data.profile) {
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

  async function loadDaily() {
    $("dailyContent").hidden = true;
    setStatus("กำลังเปิดดวงประจำวันของคุณ...");

    let response = await authorizedFetch("/api/member/daily");
    if (response.status === 202) {
      await new Promise(resolve => setTimeout(resolve, 1800));
      response = await authorizedFetch("/api/member/daily");
    }

    const data = await response.json();

    if (response.status === 409 && data?.error?.code === "PROFILE_REQUIRED") {
      $("profileForm").hidden = false;
      setStatus(data.error.message);
      return;
    }

    if (!response.ok) {
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

    setStatus(
      data.cached
        ? "ดวงวันนี้ถูกบันทึกไว้แล้ว จะรีเซ็ตเมื่อเข้าสู่วันใหม่ตามเวลาไทย"
        : "สร้างดวงวันนี้เรียบร้อยแล้ว"
    );
  }

  async function saveProfile(event) {
    event.preventDefault();

    const birthDate = $("birthDate").value;
    const birthTime = $("birthTime").value;

    if (!birthDate) {
      setStatus("กรุณาระบุวันเดือนปีเกิด");
      return;
    }

    $("saveProfile").disabled = true;

    try {
      const response = await authorizedFetch("/api/member/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate, birthTime })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || "บันทึกข้อมูลไม่สำเร็จ");
      }

      $("profileForm").hidden = true;
      await loadDaily();
    } catch (error) {
      setStatus(error.message);
    } finally {
      $("saveProfile").disabled = false;
    }
  }

  function setStatus(text) {
    $("memberStatus").textContent = text || "";
  }

  function showAuthError(error) {
    console.error("Auth0 error", error);
    const message = `ไม่สามารถลงชื่อเข้าใช้ได้: ${error?.message || "Unknown authentication error"}`;
    setStatus(message);
    window.alert(message);
  }

  window.addEventListener("DOMContentLoaded", () => {
    $("signInButton").addEventListener("click", async () => {
      try {
        await login();
      } catch (error) {
        showAuthError(error);
      }
    });

    $("logoutButton").addEventListener("click", async () => {
      try {
        await logout();
      } catch (error) {
        showAuthError(error);
      }
    });

    $("profileForm").addEventListener("submit", saveProfile);
    $("editProfile").addEventListener("click", () => {
      $("profileForm").hidden = false;
    });

    init().catch(error => {
      console.error("Member initialization failed", error);
      setStatus(`ไม่สามารถโหลดระบบสมาชิกได้: ${error?.message || "Unknown error"}`);
    });
  });
})();
