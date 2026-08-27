(() => {
  let client = null;

  const settings = () => window.SORASUKT_AUTH_CONFIG || {};
  const redirectUri = () => `${window.location.origin}/tarot/`;

  function safeReturnTo(value) {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
      return "/tarot/";
    }
    return value;
  }

  function getClient() {
    if (client) return client;
    const config = settings();
    if (!config.domain || !config.clientId) {
      throw new Error("Auth0 configuration is missing");
    }
    if (!window.auth0 || typeof window.auth0.Auth0Client !== "function") {
      throw new Error("Auth0 SPA SDK failed to load");
    }

    client = new window.auth0.Auth0Client({
      domain: config.domain,
      clientId: config.clientId,
      cacheLocation: "localstorage",
      useRefreshTokens: true,
      useRefreshTokensFallback: true,
      authorizationParams: {
        redirect_uri: redirectUri(),
        audience: config.audience,
        scope: config.scope || "openid profile email offline_access"
      }
    });
    return client;
  }

  async function init() {
    const auth = getClient();
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") && params.has("state")) {
      const result = await auth.handleRedirectCallback();
      const returnTo = safeReturnTo(result?.appState?.returnTo);
      window.history.replaceState({}, document.title, returnTo);
    }
    return auth;
  }

  async function isAuthenticated() {
    return getClient().isAuthenticated();
  }

  async function getUser() {
    return getClient().getUser();
  }

  async function getAccessToken() {
    return getClient().getTokenSilently();
  }

  async function authorizedFetch(input, initOptions = {}) {
    const token = await getAccessToken();
    const headers = new Headers(initOptions.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...initOptions, headers });
  }

  async function login(returnTo = "/tarot/") {
    return getClient().loginWithRedirect({
      appState: { returnTo: safeReturnTo(returnTo) },
      authorizationParams: {
        redirect_uri: redirectUri()
      }
    });
  }

  async function logout() {
    return getClient().logout({
      logoutParams: { returnTo: redirectUri() }
    });
  }

  window.SorasuktAuth = {
    init,
    isAuthenticated,
    getUser,
    getAccessToken,
    authorizedFetch,
    login,
    logout
  };
})();
