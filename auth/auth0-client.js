(() => {
  let client = null;
  let readyPromise = null;

  const config = () => window.SORASUKT_AUTH_CONFIG || {};
  const redirectUri = () => config().redirectUri || "https://sorasukt.com/tarot/";
  const logoutUri = () => config().logoutUri || "https://sorasukt.com/tarot/";

  const withTimeout = (promise, ms, message) => {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  };

  async function init() {
    if (client) return client;
    if (readyPromise) return readyPromise;

    readyPromise = (async () => {
      const settings = config();
      if (!settings.domain || !settings.clientId) {
        throw new Error("Auth0 configuration is missing");
      }
      if (!window.auth0 || typeof window.auth0.createAuth0Client !== "function") {
        throw new Error("Auth0 SPA SDK failed to load");
      }

      client = await withTimeout(
        window.auth0.createAuth0Client({
          domain: settings.domain,
          clientId: settings.clientId,
          useRefreshTokens: true,
          useRefreshTokensFallback: true,
          cacheLocation: "localstorage",
          authorizationParams: {
            redirect_uri: redirectUri(),
            ...(settings.audience ? { audience: settings.audience } : {})
          }
        }),
        15000,
        "Auth0 client initialization timed out"
      );

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

    try {
      return await readyPromise;
    } catch (error) {
      readyPromise = null;
      client = null;
      throw error;
    }
  }

  async function isAuthenticated() {
    const auth = await init();
    return withTimeout(auth.isAuthenticated(), 8000, "Auth0 session check timed out");
  }

  async function getUser() {
    const auth = await init();
    return auth.getUser();
  }

  async function getAccessToken() {
    const auth = await init();
    const settings = config();
    return withTimeout(
      auth.getTokenSilently({
        authorizationParams: settings.audience ? { audience: settings.audience } : {}
      }),
      12000,
      "Auth0 token request timed out"
    );
  }

  async function authorizedFetch(input, initOptions = {}) {
    const token = await getAccessToken();
    const headers = new Headers(initOptions.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...initOptions, headers });
  }

  async function login() {
    const auth = await init();
    const settings = config();
    await auth.loginWithRedirect({
      authorizationParams: {
        redirect_uri: redirectUri(),
        prompt: "login",
        ...(settings.audience ? { audience: settings.audience } : {})
      },
      appState: { returnTo: "/tarot/" }
    });
  }

  async function signup() {
    const auth = await init();
    const settings = config();
    await auth.loginWithRedirect({
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
    const auth = await init();
    await auth.logout({ logoutParams: { returnTo: logoutUri() } });
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
