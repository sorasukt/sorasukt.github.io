# Auth0 setup for sorasukt.com

Shared Auth0 SPA integration for sorasukt.com.

## Public application configuration

- Custom Domain: `auth.sorasukt.com`
- Client ID: `NbMkuqqsuljnBKcAKVDr8bICryQZR4MI`
- API audience: `https://api.sorasukt.com`
- SDK: Auth0 SPA JS 2.x
- Authentication flow: Universal Login + Authorization Code Flow with PKCE

The Client ID, domain and API audience are public SPA configuration. Never place an Auth0 Client Secret in this repository or browser JavaScript.

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

Create an Auth0 API:

```text
Name: sorasukt API
Identifier: https://api.sorasukt.com
Signing Algorithm: RS256
```

## Member profile and daily reading

Authenticated members can save:

- birth date (required for daily guidance)
- birth time (optional)
- timezone fixed to `Asia/Bangkok` for the current experience

The Cloudflare Worker stores this data in D1. The daily reading is keyed by Auth0 `sub` and the current calendar date in `Asia/Bangkok`.

On the first authenticated request of a new Thai calendar day, the Worker:

1. checks D1 for an existing completed daily reading;
2. claims a unique pending row to prevent duplicate generation;
3. derives one deterministic daily Tarot card for that account/date;
4. sends birth date, optional birth time, daily card and Thai date to Gemini;
5. stores the structured result in D1;
6. serves that cached result for the remainder of the Thai day.

The next Thai calendar day naturally produces a new cache key, so no destructive midnight cleanup job is required.

## Cloudflare storage

GitHub Actions provisions these resources when deploying the Worker:

- D1 database: `sorasukt-members`
- R2 bucket: `sorasukt-ai-archive`

D1 holds queryable profile and daily-reading records. R2 is reserved for future AI chat archives, attachments and larger log/export objects; member APIs must validate Auth0 JWTs before accessing user-specific storage.

## Protected endpoints

```text
GET /api/member/me
GET /api/member/profile
PUT /api/member/profile
GET /api/member/daily
```

All member endpoints require:

```http
Authorization: Bearer <Auth0 access token>
```

JWT verification checks RS256 signature using Auth0 JWKS plus issuer, audience, expiry/not-before and subject.
