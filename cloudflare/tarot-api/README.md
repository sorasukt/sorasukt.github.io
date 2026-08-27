# Tarot API (Cloudflare Worker + Gemini)

API สำหรับ `/tarot` โดย Cloudflare Worker ที่ `https://api.sorasukt.com` ทำหน้าที่ทั้ง member API, Auth0 server-side callback และ AI API proxy

## Auth0 architecture — Regular Web Application

`/tarot` ไม่ใช้ Auth0 SPA SDK และไม่ถือ Client Secret หรือ Auth0 token ใน browser แล้ว

Flow:

1. Browser ไป `GET https://api.sorasukt.com/auth/login`
2. Worker redirect ไป Auth0 Universal Login
3. Auth0 callback กลับ `https://api.sorasukt.com/auth/callback`
4. Worker แลก authorization code ที่ `/oauth/token` ด้วย `AUTH0_CLIENT_ID` + `AUTH0_CLIENT_SECRET`
5. Worker verify Auth0 ID token ด้วย JWKS/RS256 และตรวจ issuer, audience, expiry และ nonce
6. Worker สร้าง signed HttpOnly session cookie
7. Browser กลับ `https://sorasukt.com/tarot/`
8. Member APIs ใช้ session cookie โดย frontend เรียกด้วย `credentials: include`

Client Secret ไม่ถูกส่งไป GitHub Pages หรือ browser

## Auth0 Dashboard

Application Type:

```text
Regular Web Application
```

Allowed Callback URLs:

```text
https://api.sorasukt.com/auth/callback
```

Allowed Logout URLs:

```text
https://sorasukt.com/tarot/
https://www.sorasukt.com/tarot/
```

Application Login URI สามารถตั้งเป็น:

```text
https://api.sorasukt.com/auth/login
```

Auth0 Custom Domain:

```text
auth.sorasukt.com
```

## Worker configuration

Public/server configuration ใน `wrangler.jsonc`:

```text
AUTH0_DOMAIN=auth.sorasukt.com
AUTH0_CLIENT_ID=NbMkuqqsuljnBKcAKVDr8bICryQZR4MI
```

Secret ต้องเก็บใน Cloudflare Worker Secret เท่านั้น:

```bash
cd cloudflare/tarot-api
npx wrangler secret put AUTH0_CLIENT_SECRET
```

อย่าใส่ Client Secret ใน `wrangler.jsonc`, frontend, GitHub repository หรือ JavaScript ที่ส่งให้ browser

สำหรับ local development ใช้ `.dev.vars` ซึ่งถูก ignore จาก Git:

```env
AUTH0_CLIENT_SECRET=your_auth0_client_secret
GEMINI_API_KEY=your_gemini_key
```

## Authentication routes

```text
GET /auth/login
GET /auth/callback
GET /auth/logout
GET /api/member/me
GET /api/member/profile
PUT /api/member/profile
GET /api/member/daily
```

Session cookie เป็น `HttpOnly`, `Secure`, `SameSite=Lax` และ signed ฝั่ง Worker ข้อมูล session มีเฉพาะ claims ที่จำเป็นต่อ UI/member identity และหมดอายุตาม ID token โดยจำกัด session สูงสุดประมาณ 8 ชั่วโมงต่อการ login หนึ่งครั้ง

## Production Worker

- Worker name: `sorasukt-api`
- Custom Domain: `api.sorasukt.com`
- Tarot endpoint: `https://api.sorasukt.com/api/tarot/reading`
- `workers.dev` ปิดสำหรับ production

## GitHub → Cloudflare deployment

Workflow `.github/workflows/deploy-tarot-worker.yml` deploy เมื่อมีการ push เข้า `main`

GitHub Actions ใช้:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GEMINI_API_KEY`

`AUTH0_CLIENT_SECRET` ตั้งโดยตรงใน Cloudflare และไม่จำเป็นต้องคัดลอกมาเก็บใน GitHub Actions หลังตั้งครั้งแรก Wrangler จะตรวจว่าชื่อ secret ที่ประกาศใน `secrets.required` มีอยู่ก่อน deploy

## Manual setup

```bash
cd cloudflare/tarot-api
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put AUTH0_CLIENT_SECRET
npm run deploy
```

## Security notes

- Auth0 code exchange เกิดเฉพาะใน Worker
- ใช้ OAuth `state` ป้องกัน callback forgery/CSRF
- ใช้ OIDC `nonce` และตรวจ nonce ใน ID token
- ID token ตรวจ RS256 signature ผ่าน Auth0 JWKS
- session cookie เป็น HttpOnly และ JavaScript อ่านไม่ได้
- CORS จำกัด `https://sorasukt.com` และ `https://www.sorasukt.com`
- Member API ส่ง `Access-Control-Allow-Credentials: true` เฉพาะ origin ที่อนุญาต
- Client Secret และ Gemini API key ไม่ถูกส่งกลับ client
- `.dev.vars*`, `.env*`, `.wrangler/` และ `node_modules/` ต้องไม่ถูก commit
