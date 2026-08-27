# Tarot API (Cloudflare Worker + Gemini)

API สำหรับ `/tarot` โดย Browser จะเรียก Worker ที่ `POST https://api.sorasukt.com/api/tarot/reading` และ Worker เป็นผู้เรียก Google Gemini API ต่ออีกชั้นหนึ่ง

## Production Worker

- Worker name: `sorasukt-API`
- Custom Domain: `api.sorasukt.com`
- Tarot endpoint: `https://api.sorasukt.com/api/tarot/reading`
- `workers.dev` ถูกปิดสำหรับ production

Custom Domain ถูกกำหนดใน `wrangler.jsonc` ด้วย `custom_domain: true` ดังนั้น Cloudflare จะผูก hostname `api.sorasukt.com` เข้ากับ Worker โดยตรงและจัดการ DNS/SSL สำหรับ hostname นี้ตามระบบ Custom Domains ของ Workers

## Auth0 architecture

Frontend `/tarot` เป็น Single Page Application และใช้ Auth0 Universal Login + Authorization Code Flow with PKCE โดยตรง ดังนั้น browser ใช้เฉพาะ public configuration เช่น Auth0 Domain, SPA Client ID และ API Audience เท่านั้น และห้ามมี Client Secret อยู่ใน frontend

Worker ตรวจ access token ที่ browser ส่งมาด้วย Auth0 JWKS + RS256 พร้อมตรวจ issuer, audience, expiry และ subject การตรวจ JWT แบบนี้ไม่ต้องใช้ Client Secret

หาก Worker ต้องทำงานแบบ server-to-server กับ Auth0 ให้ใช้ Machine-to-Machine Application แยกจาก SPA และเก็บ credentials เฉพาะฝั่ง Cloudflare:

- `AUTH0_M2M_CLIENT_ID` — server-side configuration
- `AUTH0_M2M_CLIENT_SECRET` — Cloudflare Worker Secret เท่านั้น
- `AUTH0_M2M_AUDIENCE` — API audience ที่ M2M application ได้รับอนุญาตให้เรียก

โมดูล `src/auth0-server.js` รองรับ Client Credentials Flow ผ่าน `getAuth0MachineToken()` และจะไม่ log หรือส่ง Client Secret กลับไปยัง browser

ไม่ควรนำ Client Secret ของ SPA มาใช้กับ Worker ให้สร้าง Auth0 Machine-to-Machine Application แยกเมื่อจำเป็นต้องใช้ server-to-server access

## Cloudflare-only Auth0 secret setup

แนะนำให้ตั้ง `AUTH0_M2M_CLIENT_SECRET` โดยตรงใน Cloudflare เพื่อไม่ให้ secret ผ่าน GitHub repository หรือ frontend

```bash
cd cloudflare/tarot-api
npx wrangler secret put AUTH0_M2M_CLIENT_SECRET
```

จากนั้นตั้งค่าที่ไม่เป็น secret เช่น `AUTH0_M2M_CLIENT_ID` และ `AUTH0_M2M_AUDIENCE` เป็น Worker variables ผ่าน Cloudflare Dashboard หรือ environment configuration ที่เหมาะสม

สำหรับ local development สามารถใช้ `.dev.vars` ซึ่งถูก ignore จาก Git:

```env
AUTH0_M2M_CLIENT_ID=your_m2m_client_id
AUTH0_M2M_CLIENT_SECRET=your_m2m_client_secret
AUTH0_M2M_AUDIENCE=https://your-api-audience
```

อย่า commit `.dev.vars`, `.env` หรือค่าจริงของ Client Secret ลง Git

## GitHub → Cloudflare deployment

Repository มี workflow `.github/workflows/deploy-tarot-worker.yml` สำหรับ deploy Worker อัตโนมัติเมื่อมีการ push เข้า `main` และไฟล์ภายใต้ `cloudflare/tarot-api/**` เปลี่ยนแปลง

เพิ่ม Repository Actions secrets ใน GitHub จำนวน 3 ค่า:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API Token สำหรับ deploy Worker และจัดการ Custom Domain/route
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare Account ID
- `GEMINI_API_KEY` — Google Gemini API key

Workflow จะนำ `GEMINI_API_KEY` จาก GitHub Actions secret ไปตั้งเป็น Cloudflare Worker Secret ก่อน deploy ดังนั้นค่า secret จะไม่ถูก commit ลง repository

`AUTH0_M2M_CLIENT_SECRET` ไม่จำเป็นต้องเก็บใน GitHub Actions และสามารถคงอยู่เป็น Cloudflare Worker Secret ที่ตั้งโดยตรงได้

Frontend `/tarot/config.js` เรียก API ผ่าน `https://api.sorasukt.com` โดยตรง และ Worker จำกัด CORS ไว้ที่ `https://sorasukt.com` และ `https://www.sorasukt.com`

## Manual setup

```bash
cd cloudflare/tarot-api
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put AUTH0_M2M_CLIENT_SECRET
npm run deploy
```

`GEMINI_API_KEY` และ `AUTH0_M2M_CLIENT_SECRET` ต้องเป็น Cloudflare Secrets เท่านั้น ห้ามใส่ค่าจริงลงใน `wrangler.jsonc`, JavaScript ฝั่งเว็บ หรือ commit ลง Git

## Development

สร้างไฟล์ `.dev.vars` ในโฟลเดอร์นี้ (อย่า commit):

```env
GEMINI_API_KEY=your_local_key
AUTH0_M2M_CLIENT_ID=your_m2m_client_id
AUTH0_M2M_CLIENT_SECRET=your_m2m_client_secret
AUTH0_M2M_AUDIENCE=https://your-api-audience
```

จากนั้นรัน:

```bash
npm run dev
```

หากทดสอบ frontend กับ Worker local ให้เพิ่ม localhost origin ลง `ALLOWED_ORIGINS` เฉพาะ environment สำหรับ development

## Request

```json
{
  "question": "ช่วงนี้ฉันควรให้ความสำคัญกับอะไร?",
  "language": "th",
  "cards": [
    {"cardId": 0, "orientation": "upright"},
    {"cardId": 17, "orientation": "upright"},
    {"cardId": 9, "orientation": "upright"},
    {"cardId": 1, "orientation": "upright"},
    {"cardId": 21, "orientation": "upright"}
  ]
}
```

Worker จะไม่เชื่อชื่อไพ่จาก client แต่จะ lookup `cardId` จากสำรับ canonical 78 ใบฝั่ง server และกำหนด spread positions ตามลำดับเอง

## Security notes

- CORS จำกัดตาม `ALLOWED_ORIGINS`
- Member API ตรวจ Auth0 access token ด้วย JWKS/RS256; Client Secret ไม่ใช้สำหรับ browser JWT validation
- Auth0 M2M Client Secret อยู่ใน Cloudflare Worker Secret เท่านั้น
- SPA และ Machine-to-Machine credentials แยกออกจากกัน
- Request ต้องมีไพ่ 5 ใบพอดีและห้ามซ้ำ
- คำถามยาวไม่เกิน 500 ตัวอักษร
- Gemini API key ไม่ถูกส่งกลับ client
- Gemini errors ถูกแปลงเป็น public error code แบบทั่วไป
- AI output ถูกส่งเป็น Structured JSON และ frontend render ผ่าน `textContent`
- `.dev.vars*`, `.env*`, `.wrangler/` และ `node_modules/` ถูก ignore จาก Git
- ควรเพิ่ม Cloudflare Rate Limiting rule สำหรับ path `/api/tarot/reading` ก่อนเปิด production traffic
