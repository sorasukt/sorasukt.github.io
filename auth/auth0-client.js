(() => {
  let client = null;

  const config = () => window.SORASUKT_AUTH_CONFIG || {};
  const redirectUri = () => config().redirectUri || "https://sorasukt.com/tarot/";
  const logoutUri = () => config().logoutUri || "https://sorasukt.com/tarot/";

  function getClient() {
    if (client) return client;
    const settings = config();
    if (!settings.domain || !settings.clientId) {
      throw new Error("Auth0 configuration is missing");
    }
    if (!window.auth0 || typeof window.auth0.Auth0Client !== "function") {
      throw new Error("Auth0 SPA SDK failed to load");
    }

    // Use the direct constructor so clicking Sign In does not wait for
    // createAuth0Client() to perform a silent session check first.
    client = new window.auth0.Auth0Client({
      domain: settings.domain,
      clientId: settings.clientId,
      cacheLocation: "localstorage",
      useRefreshTokens: true,
      useRefreshTokensFallback: true,
      authorizationParams: {
        redirect_uri: redirectUri(),
        ...(settings.audience ? { audience: settings.audience } : {})
      }
    });
    return client;
  }

  async function init() {
    const auth = getClient();
    const params = new URLSearchParams(window.location.search);
    if (params.has("code") && params.has("state")) {
      const result = await auth.handleRedirectCallback();
      const returnTo = result?.appState?.returnTo || "/tarot/";
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
    const settings = config();
    return getClient().getTokenSilently({
      authorizationParams: settings.audience ? { audience: settings.audience } : {}
    });
  }

  async function authorizedFetch(input, initOptions = {}) {
    const token = await getAccessToken();
    const headers = new Headers(initOptions.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...initOptions, headers });
  }

  async function login() {
    const settings = config();
    // Universal Login redirect starts immediately from the click gesture.
    return getClient().loginWithRedirect({
      authorizationParams: {
        redirect_uri: redirectUri(),
        ...(settings.audience ? { audience: settings.audience } : {})
      },
      appState: { returnTo: "/tarot/" }
    });
  }

  async function logout() {
    return getClient().logout({
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
    logout
  };
})();
