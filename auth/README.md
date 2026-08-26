# Auth0 setup for sorasukt.com

Shared Auth0 SPA integration for sorasukt.com.

## Public application configuration

- Custom Domain: `auth.sorasukt.com`
- Client ID: `NbMkuqqsuljnBKcAKVDr8bICryQZR4MI`
- SDK: Auth0 SPA JS 2.x
- Authentication flow: Universal Login + Authorization Code Flow with PKCE

The Client ID and Auth0 domain are public SPA configuration and may be shipped to the browser. Never place an Auth0 Client Secret in this repository or in browser JavaScript.

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

## Shared files

- `/auth/auth0-config.js` — public Auth0 domain/client ID
- `/auth/auth0-client.js` — shared login/logout/session helper
- `/auth/auth0.css` — shared authentication controls

The Tarot page currently consumes this shared layer. Future member pages should reuse `window.SorasuktAuth` instead of creating another Auth0 client instance.

## Future API authorization

When `api.sorasukt.com` begins protecting member APIs, create/configure an Auth0 API identifier (audience) and request access tokens for that audience from the SPA. The Cloudflare Worker must validate JWT signature, issuer, audience, expiry, and permissions server-side before accessing member D1/R2 data.
