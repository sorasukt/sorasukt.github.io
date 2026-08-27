function normalizeDomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export function hasAuth0MachineCredentials(env) {
  return Boolean(
    normalizeDomain(env.AUTH0_DOMAIN) &&
    env.AUTH0_M2M_CLIENT_ID &&
    env.AUTH0_M2M_CLIENT_SECRET
  );
}

export async function getAuth0MachineToken(env, { audience, scope } = {}) {
  const domain = normalizeDomain(env.AUTH0_DOMAIN);
  const clientId = String(env.AUTH0_M2M_CLIENT_ID || "").trim();
  const clientSecret = String(env.AUTH0_M2M_CLIENT_SECRET || "");
  const targetAudience = String(audience || env.AUTH0_M2M_AUDIENCE || "").trim();

  if (!domain || !clientId || !clientSecret || !targetAudience) {
    throw new Error("Auth0 machine-to-machine credentials are not configured");
  }

  const body = {
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    audience: targetAudience
  };

  if (scope) body.scope = String(scope);

  const response = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    console.error("Auth0 machine token request failed", response.status);
    throw new Error("Auth0 machine token request failed");
  }

  const data = await response.json();
  if (!data?.access_token || typeof data.access_token !== "string") {
    throw new Error("Auth0 machine token response is invalid");
  }

  return {
    accessToken: data.access_token,
    tokenType: data.token_type || "Bearer",
    expiresIn: Number(data.expires_in || 0)
  };
}
