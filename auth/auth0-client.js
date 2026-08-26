(() => {
  let client = null;
  let readyPromise = null;

  const currentUri = () => `${window.location.origin}${window.location.pathname}`;
  const withTimeout = (promise, ms, message) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  };

  async function init() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      const config = window.SORASUKT_AUTH_CONFIG;
      if (!config?.domain || !config?.clientId || !window.auth0?.Auth0Client) {
        throw new Error("Auth0 SDK is unavailable or not configured");
      }

      client = new window.auth0.Auth0Client({
        domain: config.domain,
        clientId: config.clientId,
        useRefreshTokens: true,
        useRefreshTokensFallback: true,
        cacheLocation: "localstorage",
        authorizationParams: {
          redirect_uri: currentUri(),
          ...(config.audience ? { audience: config.audience } : {})
        }
      });

      const params = new URLSearchParams(window.location.search);
      if (params.has("code") && params.has("state")) {
        try {
          const result = await withTimeout(client.handleRedirectCallback(), 15000, "Auth0 callback timed out");
          const returnTo = result?.appState?.returnTo || window.location.pathname;
          window.history.replaceState({}, document.title, returnTo + window.location.hash);
        } catch (error) {
          console.error("Auth0 callback failed", error);
          window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
          throw error;
        }
      }

      return client;
    })();
    return readyPromise;
  }

  async function isAuthenticated() {
    await init();
    return withTimeout(client.isAuthenticated(), 8000, "Auth0 session check timed out");
  }

  async function getUser() {
    await init();
    return client.getUser();
  }

  async function getAccessToken() {
    await init();
    const config = window.SORASUKT_AUTH_CONFIG;
    return withTimeout(
      client.getTokenSilently({
        authorizationParams: config?.audience ? { audience: config.audience } : {}
      }),
      12000,
      "Auth0 token request timed out"
    );
  }

  async function authorizedFetch(input, init = {}) {
    const token = await getAccessToken();
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }

  async function login() {
    await init();
    const config = window.SORASUKT_AUTH_CONFIG;
    return client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: currentUri(),
        ...(config?.audience ? { audience: config.audience } : {})
      },
      appState: { returnTo: window.location.pathname }
    });
  }

  async function signup() {
    await init();
    const config = window.SORASUKT_AUTH_CONFIG;
    return client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: currentUri(),
        screen_hint: "signup",
        ...(config?.audience ? { audience: config.audience } : {})
      },
      appState: { returnTo: window.location.pathname }
    });
  }

  async function logout() {
    await init();
    const authenticated = await client.isAuthenticated().catch(() => false);
    if (!authenticated) {
      window.location.href = currentUri();
      return;
    }
    return client.logout({
      logoutParams: { returnTo: currentUri() }
    });
  }

  window.SorasuktAuth = { init, isAuthenticated, getUser, getAccessToken, authorizedFetch, login, signup, logout };
})();
