(() => {
  let client = null;
  let readyPromise = null;

  const config = () => window.SORASUKT_AUTH_CONFIG || {};
  const redirectUri = () => config().redirectUri || `${window.location.origin}${window.location.pathname}`;
  const logoutUri = () => config().logoutUri || redirectUri();

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
      const settings = config();
      if (!settings.domain || !settings.clientId || !window.auth0?.Auth0Client) {
        throw new Error("Auth0 SDK is unavailable or not configured");
      }

      client = new window.auth0.Auth0Client({
        domain: settings.domain,
        clientId: settings.clientId,
        useRefreshTokens: true,
        useRefreshTokensFallback: true,
        cacheLocation: "localstorage",
        authorizationParams: {
          redirect_uri: redirectUri(),
          ...(settings.audience ? { audience: settings.audience } : {})
        }
      });

      const params = new URLSearchParams(window.location.search);
      if (params.has("code") && params.has("state")) {
        try {
          const result = await withTimeout(
            client.handleRedirectCallback(),
            15000,
            "Auth0 callback timed out"
          );
          const returnTo = result?.appState?.returnTo || "/tarot/";
          window.history.replaceState({}, document.title, returnTo);
        } catch (error) {
          console.error("Auth0 callback failed", error);
          window.history.replaceState({}, document.title, "/tarot/");
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
    const settings = config();
    return withTimeout(
      client.getTokenSilently({
        authorizationParams: settings.audience ? { audience: settings.audience } : {}
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
    const settings = config();
    return client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: redirectUri(),
        prompt: "login",
        ...(settings.audience ? { audience: settings.audience } : {})
      },
      appState: { returnTo: "/tarot/" }
    });
  }

  async function signup() {
    await init();
    const settings = config();
    return client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: redirectUri(),
        screen_hint: "signup",
        prompt: "login",
        ...(settings.audience ? { audience: settings.audience } : {})
      },
      appState: { returnTo: "/tarot/" }
    });
  }

  async function logout() {
    await init();
    return client.logout({
      logoutParams: { returnTo: logoutUri() }
    });
  }

  window.SorasuktAuth = {
    init,
    isAuthenticated,
    getUser,
    getAccessToken,
    authorizedFetch,
    login,
    signup,
    logout
  };
})();
