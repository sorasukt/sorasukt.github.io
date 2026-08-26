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
          redirect_uri: currentUri()
        }
      });

      const params = new URLSearchParams(window.location.search);
      if (params.has("code") && params.has("state")) {
        await client.handleRedirectCallback();
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
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

  async function login() {
    await init();
    return client.loginWithRedirect({
      authorizationParams: { redirect_uri: currentUri() },
      appState: { returnTo: window.location.pathname }
    });
  }

  async function signup() {
    await init();
    return client.loginWithRedirect({
      authorizationParams: {
        redirect_uri: currentUri(),
        screen_hint: "signup"
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

  window.SorasuktAuth = { init, isAuthenticated, getUser, login, signup, logout };
})();
