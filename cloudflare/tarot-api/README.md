# Tarot API (Cloudflare Worker + Gemini)

API สำหรับ `/tarot` โดย Browser จะเรียก Worker ที่ `POST /api/tarot/reading` และ Worker เป็นผู้เรียก Google Gemini API ต่ออีกชั้นหนึ่ง

## Setup

```bash
cd cloudflare/tarot-api
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npm run deploy
```

`GEMINI_API_KEY` ต้องเป็น Cloudflare Secret เท่านั้น ห้ามใส่ค่า key ลงใน `wrangler.jsonc`, JavaScript ฝั่งเว็บ หรือ commit ลง Git

## Development

สร้างไฟล์ `.dev.vars` ในโฟลเดอร์นี้ (อย่า commit):

```env
GEMINI_API_KEY=your_local_key
```

จากนั้นรัน:

```bash
npm run dev
```

หากทดสอบ frontend กับ Worker local ให้เพิ่ม `http://localhost:...` ลง `ALLOWED_ORIGINS` เฉพาะ environment สำหรับ development

## Production routing

Frontend `/tarot/config.js` ตั้งค่าเริ่มต้นให้เรียก same-origin path `/api/tarot/reading` เพื่อให้สามารถใช้ Cloudflare Worker route/custom domain ดักเฉพาะ `/api/tarot/*` ได้

อีกทางเลือกหนึ่งคือ deploy เป็น `workers.dev` หรือ custom API subdomain แล้วแก้ `window.TAROT_CONFIG.apiBaseUrl` ใน `tarot/config.js` เป็น URL ของ Worker

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
- Request ต้องมีไพ่ 5 ใบพอดีและห้ามซ้ำ
- คำถามยาวไม่เกิน 500 ตัวอักษร
- Gemini API key ไม่ถูกส่งกลับ client
- Gemini errors ถูกแปลงเป็น public error code แบบทั่วไป
- AI output ถูกส่งเป็น Structured JSON และ frontend render ผ่าน `textContent`
- ควรเพิ่ม Cloudflare Rate Limiting rule สำหรับ path `/api/tarot/reading` ก่อนเปิด production traffic
