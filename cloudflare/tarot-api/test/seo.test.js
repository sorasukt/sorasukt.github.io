import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const pages=[
  ["../../../index.html","https://sorasukt.com/"],
  ["../../../tarot/index.html","https://sorasukt.com/tarot/"],
  ["../../../tarot/reading/index.html","https://sorasukt.com/tarot/reading/"],
  ["../../../tarot/astrology/index.html","https://sorasukt.com/tarot/astrology/"],
  ["../../../tarot/zodiac/index.html","https://sorasukt.com/tarot/zodiac/"],
  ["../../../tarot/numbers/index.html","https://sorasukt.com/tarot/numbers/"],
  ["../../../tarot/naming/index.html","https://sorasukt.com/tarot/naming/"],
  ["../../../tarot/about/index.html","https://sorasukt.com/tarot/about/"],
  ["../../../privacy/index.html","https://sorasukt.com/privacy/"],
  ["../../../privacy/google/index.html","https://sorasukt.com/privacy/google/"],
  ["../../../terms/index.html","https://sorasukt.com/terms/"]
];

test("every public page has complete discoverability metadata",async()=>{
  for(const [file,canonical] of pages){
    const html=await readFile(new URL(file,import.meta.url),"utf8");
    assert.equal((html.match(/<title>/g)||[]).length,1,file);
    assert.match(html,/<meta name="description" content="[^"]+">/,file);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}">`),file);
    assert.match(html,/<meta name="robots" content="index,follow,max-image-preview:large">/,file);
    assert.match(html,/<meta property="og:title" content="[^"]+">/,file);
    assert.match(html,/<meta name="twitter:title" content="[^"]+">/,file);
  }
});

test("private account page is excluded from search",async()=>{
  const html=await readFile(new URL("../../../tarot/me/index.html",import.meta.url),"utf8");
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
});

