(() => {
  let client = null;
  let readyPromise = null;

  const currentUri = () => `${window.location.origin}${window.location.pathname}`;

  async function init() {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      const config = window.SORASUKT_AUTH_CONFIG;
      if (!config?.domain || !config?.clientId || !window.auth0?.createAuth0Client) {
        throw new Error("Auth0 is not configured");
      }

      client = await window.auth0.createAuth0Client({
        domain: config.domain,
        clientId: config.clientId,
        authorizationParams: {
          redirect_uri: currentUri(),
          ...(config.audience ? { audience: config.audience } : {})
        }
      });

      const params = new URLSearchParams(window.location.search);
      if (params.has("code") && params.has("state")) {
        const result = await client.handleRedirectCallback();
        const returnTo = result?.appState?.returnTo || window.location.pathname;
        window.history.replaceState({}, document.title, returnTo + window.location.hash);
      }

      return client;
    })();
    return readyPromise;
  }

  async function isAuthenticated() {
    await init();
    return client.isAuthenticated();
  }

  async function getUser() {
    await init();
    return client.getUser();
  }

  async function getAccessToken() {
    await init();
    const config = window.SORASUKT_AUTH_CONFIG;
    return client.getTokenSilently({
      authorizationParams: config?.audience ? { audience: config.audience } : {}
    });
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
    return client.logout({
      logoutParams: { returnTo: currentUri() }
    });
  }

  window.SorasuktAuth = { init, isAuthenticated, getUser, getAccessToken, authorizedFetch, login, signup, logout };
})();
