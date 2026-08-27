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
    addEventListener() {},
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
    addEventListener() {}
  };
  const context = {
    addEventListener(type, handler) { if (type === "DOMContentLoaded") ready.push(handler); },
    clearTimeout,
    console,
    Date,
    document,
    Intl,
    location: { assign() {}, href: "https://sorasukt.com/tarot/me/" },
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
