# Auth0 setup for sorasukt.com

Shared Auth0 SPA integration for sorasukt.com.

## Public application configuration

- Custom Domain: `auth.sorasukt.com`
- Client ID: `NbMkuqqsuljnBKcAKVDr8bICryQZR4MI`
- SDK: Auth0 SPA JS 2.x
- Authentication flow: Universal Login + Authorization Code Flow with PKCE
- API audience: `https://api.sorasukt.com`

The Client ID, Auth0 domain, and API audience are public SPA configuration and may be shipped to the browser. Never place an Auth0 Client Secret in this repository or in browser JavaScript.

## Auth0 Dashboard settings

Configure the Auth0 application as a **Single Page Application**.

### Allowed Callback URLs

```text
https://sorasukt.com/tarot/
https://www.sorasukt.com/tarot/
```

### Allowed Logout URLs

```text
https://sorasukt.com/tarot/
https://www.sorasukt.com/tarot/
```

### Allowed Web Origins

```text
https://sorasukt.com
https://www.sorasukt.com
```

For local development, add localhost URLs only to the Auth0 development configuration as needed.

## Auth0 API

Create an Auth0 API under **Applications → APIs** with:

```text
Name: sorasukt API
Identifier: https://api.sorasukt.com
Signing Algorithm: RS256
```

The Identifier is the audience requested by the SPA and validated by the Cloudflare Worker. Do not change it independently on one side.

## Shared files

- `/auth/auth0-config.js` — public Auth0 domain, client ID, and API audience
- `/auth/auth0-client.js` — shared login/logout/session/access-token helper
- `/auth/auth0.css` — shared authentication controls

The shared client exposes:

- `SorasuktAuth.login()`
- `SorasuktAuth.logout()`
- `SorasuktAuth.getUser()`
- `SorasuktAuth.getAccessToken()`
- `SorasuktAuth.authorizedFetch()`

Future member pages should reuse this layer instead of creating another Auth0 client instance.

## Cloudflare API authorization

The Worker validates Auth0 access tokens server-side before member data is returned. Validation includes:

- RS256 signature against `https://auth.sorasukt.com/.well-known/jwks.json`
- issuer `https://auth.sorasukt.com/`
- audience `https://api.sorasukt.com`
- expiry/not-before timestamps
- authenticated subject (`sub`)

Protected test endpoint:

```http
GET https://api.sorasukt.com/api/member/me
Authorization: Bearer <access_token>
```

The public Tarot reading endpoint remains public for now. D1/R2 member endpoints should call the same JWT validation layer before reading or writing user-specific data.
