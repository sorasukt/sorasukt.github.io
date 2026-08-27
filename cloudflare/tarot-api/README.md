# Tarot API (Cloudflare Worker + Gemini)

API สำหรับ `/tarot` โดย Cloudflare Worker ที่ `https://api.sorasukt.com` ทำหน้าที่ทั้ง member API, Auth0 server-side callback, Google Places proxy และ AI API proxy

## Auth0 — Regular Web Application

`/tarot` ไม่ใช้ Auth0 SPA SDK และไม่ถือ Client Secret หรือ Auth0 token ใน browser

Flow:

1. Browser ไป `GET https://api.sorasukt.com/auth/login`
2. Worker redirect ไป Auth0 Universal Login
3. Auth0 callback กลับ `https://api.sorasukt.com/auth/callback`
4. Worker แลก authorization code ที่ `/oauth/token` ด้วย `AUTH0_CLIENT_ID` + `AUTH0_CLIENT_SECRET`
5. Worker verify ID token ด้วย Auth0 JWKS/RS256 พร้อมตรวจ issuer, audience, expiry, state และ nonce
6. Worker สร้าง signed HttpOnly session cookie
7. Browser กลับ `https://sorasukt.com/tarot/`
8. Member APIs ใช้ session cookie โดย frontend เรียกด้วย `credentials: include`

## Cloudflare secrets

```bash
cd cloudflare/tarot-api
npx wrangler secret put AUTH0_CLIENT_SECRET
npx wrangler secret put GEMINI_API_KEY
```

สอง secret นี้ถูกประกาศเป็น required ใน `wrangler.json` ดังนั้น deployment จะหยุดก่อนเผยแพร่หาก Worker ยังขาดค่าใดค่าหนึ่ง

`GOOGLE_MAPS_API_KEY` เป็น optional ชั่วคราวและไม่บล็อก deployment หากยังไม่มีคีย์ การบันทึกวันเกิดและเวลาเกิดยังใช้งานได้ตามปกติ แต่ระบบค้นหา/ยืนยันสถานที่เกิดจะยังไม่พร้อมใช้งาน หากต้องการเปิดภายหลังให้รัน:

ระหว่างนี้ให้เว้นช่องสถานที่เกิดในหน้า `ฉัน` ไว้ก่อน

```bash
npx wrangler secret put GOOGLE_MAPS_API_KEY
```

คีย์นี้ใช้เฉพาะ Worker และไม่ถูกส่งไป browser โดยต้องเปิด API ใน Google Cloud อย่างน้อย:

- Places API (New)
- Time Zone API

แนะนำให้จำกัด key ให้ใช้เฉพาะ API เหล่านี้และตั้ง quota/budget alert ใน Google Cloud

สำหรับ local development ใช้ `.dev.vars`:

```env
AUTH0_CLIENT_SECRET=your_auth0_client_secret
GEMINI_API_KEY=your_gemini_key
# Optional: GOOGLE_MAPS_API_KEY=your_google_maps_key
```

## Member & Places routes

```text
GET /auth/login
GET /auth/callback
GET /auth/logout
GET /api/member/me
GET /api/member/profile
POST /api/member/profile
GET /api/member/daily
GET /api/member/astrology
GET /api/member/places/autocomplete?q=...
```

เมื่อผู้ใช้เลือกสถานที่เกิด Worker จะ resolve Google Place ID เป็นชื่อสถานที่ พิกัด latitude/longitude และ timezone แล้วเก็บลง D1 โดยไม่เชื่อถือพิกัดที่ส่งมาจาก browser

Session cookie เป็น `HttpOnly`, `Secure`, `SameSite=Lax` และ signed ฝั่ง Worker

## Abuse protection and validation

- คำขอที่เรียก Gemini ถูกจำกัดรวม 20 ครั้งต่อนาทีต่อสมาชิก หรือ per-IP สำหรับผู้ใช้ทั่วไป ผ่าน `AI_RATE_LIMITER`
- Request body ถูกอ่านแบบ bounded stream: 12 KB สำหรับ AI routes และ 4 KB สำหรับ member profile
- ผลลัพธ์จาก Gemini จำกัด output token และ daily reading ที่ค้าง `pending` เกินหนึ่งนาทีสามารถเริ่มใหม่ได้
- รัน `npm run check` เพื่อตรวจ syntax และชุดทดสอบด้วย Node.js test runner

## Security notes

- OAuth code exchange เกิดเฉพาะใน Worker
- ใช้ `state` และ OIDC `nonce`
- ID token ตรวจ RS256 signature ผ่าน Auth0 JWKS
- session cookie อ่านจาก JavaScript ไม่ได้
- CORS จำกัด `https://sorasukt.com` และ `https://www.sorasukt.com`
- Auth0, Gemini และ Google Maps secrets ไม่ถูกส่งกลับ client
