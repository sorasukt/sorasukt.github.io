# Tarot API (Cloudflare Worker + Gemini)

API สำหรับ `/tarot` โดย Browser จะเรียก Worker ที่ `POST /api/tarot/reading` และ Worker เป็นผู้เรียก Google Gemini API ต่ออีกชั้นหนึ่ง

## GitHub → Cloudflare deployment

Repository มี workflow `.github/workflows/deploy-tarot-worker.yml` สำหรับ deploy Worker อัตโนมัติเมื่อมีการ push เข้า `main` และไฟล์ภายใต้ `cloudflare/tarot-api/**` เปลี่ยนแปลง

เพิ่ม Repository Actions secrets ใน GitHub จำนวน 3 ค่า:

- `CLOUDFLARE_API_TOKEN` — Cloudflare API Token ที่มีสิทธิ์ Workers Scripts: Edit และ Workers Routes: Edit เฉพาะ account/zone ที่ต้องใช้
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare Account ID
- `GEMINI_API_KEY` — Google Gemini API key

Workflow จะนำ `GEMINI_API_KEY` จาก GitHub Actions secret ไปตั้งเป็น Cloudflare Worker Secret ก่อน deploy ดังนั้นค่า secret จะไม่ถูก commit ลง repository

Cloudflare routes ถูกกำหนดใน `wrangler.jsonc` ให้ Worker รับเฉพาะ:

- `sorasukt.com/api/tarot/*`
- `www.sorasukt.com/api/tarot/*`

ดังนั้น frontend สามารถเรียก same-origin endpoint `/api/tarot/reading` ได้โดยไม่ต้องเปิดเผย Worker URL

## Manual setup

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
- `.dev.vars*`, `.env*`, `.wrangler/` และ `node_modules/` ถูก ignore จาก Git
- ควรเพิ่ม Cloudflare Rate Limiting rule สำหรับ path `/api/tarot/reading` ก่อนเปิด production traffic
