import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const repositoryRoot = new URL("../../../", import.meta.url);

function fakeElement() {
  return {
    hidden: false,
    value: "",
    textContent: "",
    innerHTML: "",
    classList: { add() {}, remove() {} },
    addEventListener() {},
    focus() {},
    querySelector() { return fakeElement(); }
  };
}

function browserContext(member = null) {
  const elements = new Map();
  const ready = [];
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, fakeElement());
      return elements.get(selector);
    },
    getElementById(id) {
      const selector = `#${id}`;
      if (!elements.has(selector)) elements.set(selector, fakeElement());
      return elements.get(selector);
    },
    body: { classList: { add() {}, remove() {} } },
    addEventListener() {}
  };
  const context = {
    addEventListener(type, handler) { if (type === "DOMContentLoaded") ready.push(handler); },
    clearTimeout,
    console,
    Date,
    document,
    Intl,
    location: { assign() {}, href: "https://sorasukt.com/tarot/me/", origin: "https://sorasukt.com" },
    requestAnimationFrame(handler) { handler(); },
    setTimeout,
    window: {
      TarotPortal: {
        api: async () => new Response("{}", { status: 200 }),
        clearMemberCache() {},
        getMember: async () => member
      }
    }
  };
  return { context, elements, ready };
}

async function loadScript(path, context) {
  const source = await readFile(new URL(path, repositoryRoot), "utf8");
  vm.runInNewContext(source, context, { filename: path });
}

test("My Account script initializes and renders member data", async () => {
  const fixture = browserContext({
    success: true,
    user: { name: "Sorasuk", email: "member@example.com" },
    profile: { birth_date: "2000-01-02", birth_time: "09:30" },
    completion: { hasBirthDate: true, hasBirthTime: true, hasBirthPlace: false }
  });
  await loadScript("tarot/me/me.js", fixture.context);
  assert.equal(fixture.ready.length, 1);
  assert.doesNotThrow(() => fixture.ready[0]());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.elements.get("#accountName").textContent, "Sorasuk");
  assert.equal(fixture.elements.get("#accountEmail").textContent, "member@example.com");
  assert.equal(fixture.elements.get("#birthDate").value, "2000-01-02");
  assert.equal(fixture.elements.get("#profileStatus").textContent, "ข้อมูลของคุณพร้อมใช้งาน");
});

test("Astrology script binds its form without a selector error", async () => {
  const fixture = browserContext(null);
  await assert.doesNotReject(loadScript("tarot/astrology/astrology.js", fixture.context));
  assert.equal(fixture.ready.length, 1);
});

test("Zodiac form hydrates a signed-in member birth date", async () => {
  const fixture = browserContext({success:true,profile:{birth_date:"1991-08-12"}});
  await loadScript("tarot/zodiac/zodiac.js", fixture.context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.elements.get("#zodiacBirthDate").value,"1991-08-12");
});

test("Home uses member context to hydrate saved birth data", async () => {
  const fixture = browserContext({success:true,profile:{birth_date:"1991-08-12",birth_time:"07:45"}});
  await loadScript("tarot/home.js", fixture.context);
  assert.equal(fixture.ready.length,1);
  fixture.ready[0]();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fixture.elements.get("#quickBirthDate").value,"1991-08-12");
  assert.equal(fixture.elements.get("#modalBirthTime").value,"07:45");
});

test("Tarot reading shuffles before enabling card selection", async () => {
  const [html,script,styles]=await Promise.all([
    readFile(new URL("tarot/reading/index.html",repositoryRoot),"utf8"),
    readFile(new URL("tarot/app.js",repositoryRoot),"utf8"),
    readFile(new URL("tarot/shuffle.css",repositoryRoot),"utf8")
  ]);
  assert.match(html,/id="shuffleStage"[^>]+aria-live="polite"/);
  assert.match(html,/id="deck"[^>]+hidden/);
  assert.match(script,/async function beginShuffle\(\)/);
  assert.ok(script.indexOf("await new Promise")<script.indexOf("renderDeck();els.shuffleStage.hidden=true"));
  assert.match(script,/setAttribute\("inert",""\)/);
  assert.match(styles,/@keyframes shuffle-card/);
  assert.match(styles,/@media \(prefers-reduced-motion: reduce\)/);
});

test("lucky-color pages expose an accessible member result and selected-date tool",async()=>{
  const [home,page,script]=await Promise.all([
    readFile(new URL("tarot/index.html",repositoryRoot),"utf8"),
    readFile(new URL("tarot/colors/index.html",repositoryRoot),"utf8"),
    readFile(new URL("tarot/colors/colors.js",repositoryRoot),"utf8")
  ]);
  assert.match(home,/สำหรับคุณเท่านั้น/);
  assert.match(home,/id="dailyLuckyColor"/);
  assert.match(page,/id="colorDate"[^>]+required/);
  assert.match(page,/id="colorResult"[^>]+aria-live="polite"/);
  assert.match(script,/TarotPortal\.setLoading/);
  assert.ok(script.includes("^#[0-9A-Fa-f]{6}$"));
});

test("billing pages use Stripe-hosted payment, shipping, receipts, and Customer Portal",async()=>{
  const [membership,support,success,membershipScript,supportScript,successScript]=await Promise.all([
    readFile(new URL("tarot/membership/index.html",repositoryRoot),"utf8"),
    readFile(new URL("tarot/support/index.html",repositoryRoot),"utf8"),
    readFile(new URL("tarot/billing/success/index.html",repositoryRoot),"utf8"),
    readFile(new URL("tarot/membership/membership.js",repositoryRoot),"utf8"),
    readFile(new URL("tarot/support/support.js",repositoryRoot),"utf8"),
    readFile(new URL("tarot/billing/success/success.js",repositoryRoot),"utf8")
  ]);
  assert.match(membership,/Subscription · ต่ออายุอัตโนมัติ/);
  assert.match(membership,/Pay as you go · ชำระครั้งเดียว/);
  assert.match(membership,/Subscription คุ้มกว่าอย่างไร/);
  assert.match(membership,/id="priceComparisonBody"/);
  assert.match(support,/PromptPay/);assert.match(support,/ที่อยู่จัดส่ง/);
  assert.match(support,/id="supportButton"[^>]*>ดำเนินต่อ</);
  assert.match(success,/aria-live="polite"/);
  assert.match(membershipScript,/\/api\/billing\/portal/);
  assert.match(membershipScript,/ลงชื่อใช้งานเพื่อสมัคร/);
  assert.match(membershipScript,/ประหยัด/);
  assert.match(membershipScript,/Subscription รายเดือนครบ 12 เดือน/);
  assert.match(supportScript,/checkout\/support/);
  assert.match(successScript,/ดูใบเสร็จ/);
  assert.match(successScript,/จัดการสมาชิก/);
});
