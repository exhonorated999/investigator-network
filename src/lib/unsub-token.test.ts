import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildUnsubscribeUrl,
  createUnsubToken,
  listUnsubscribeHeaders,
  openUnsubToken,
  unsubscribeSecret,
} from "./unsub-token";

const SECRET = "test-unsubscribe-secret";

describe("sealed unsubscribe tokens", () => {
  it("round-trips the address without putting it in the token", () => {
    const email = "very-unique-recipient@example.com";
    const token = createUnsubToken(`  ${email.toUpperCase()}  `, SECRET);
    assert.equal(token.startsWith("v1."), true);
    assert.equal(openUnsubToken(token, SECRET), email);
    assert.equal(token.includes(email), false);
    assert.equal(
      Buffer.from(token.slice(3), "base64url").includes(Buffer.from(email)),
      false
    );
    assert.notEqual(createUnsubToken(email, SECRET), token);
  });

  it("rejects a forged token, the wrong key, and legacy hex", () => {
    const token = createUnsubToken("ada@example.com", SECRET);
    const chars = token.split("");
    const index = Math.floor(token.length / 2);
    chars[index] = chars[index] === "a" ? "b" : "a";
    assert.equal(openUnsubToken(chars.join(""), SECRET), null);
    assert.equal(openUnsubToken(token, "other-secret"), null);
    assert.equal(openUnsubToken("ab".repeat(18), SECRET), null);
    assert.equal(openUnsubToken("v2.aaaa", SECRET), null);
    assert.equal(openUnsubToken(token, null), null);
  });

  it("keeps an opaque token when there is no secret or the address is unusable", () => {
    assert.match(createUnsubToken("ada@example.com", null), /^[0-9a-f]{36}$/);
    assert.match(createUnsubToken("not-an-email", SECRET), /^[0-9a-f]{36}$/);
  });

  it("reads the signing secret from UNSUBSCRIBE_SECRET, then AUTH_SECRET", () => {
    assert.equal(
      unsubscribeSecret({ UNSUBSCRIBE_SECRET: " dedicated ", AUTH_SECRET: "auth" } as NodeJS.ProcessEnv),
      "dedicated"
    );
    assert.equal(
      unsubscribeSecret({ AUTH_SECRET: " auth " } as NodeJS.ProcessEnv),
      "auth"
    );
    assert.equal(unsubscribeSecret({} as NodeJS.ProcessEnv), null);
  });
});

describe("unsubscribe link headers", () => {
  it("builds an encoded URL and the RFC 8058 header pair", () => {
    const url = buildUnsubscribeUrl("v1.abc_def-xyz", "https://www.inv-network.org/");
    assert.equal(
      url,
      "https://www.inv-network.org/api/unsubscribe?token=v1.abc_def-xyz"
    );
    assert.deepEqual(listUnsubscribeHeaders(url), {
      "List-Unsubscribe": `<${url}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("strips header injection from the List-Unsubscribe value", () => {
    const headers = listUnsubscribeHeaders("https://x.test/u\r\nBcc: evil@x.test");
    assert.equal(headers["List-Unsubscribe"].includes("\n"), false);
    assert.equal(headers["List-Unsubscribe"].includes("\r"), false);
    assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  });

  it("is what campaign sends attach, including test sends", () => {
    const src = readFileSync(new URL("./campaigns.ts", import.meta.url), "utf8");
    assert.equal(src.split("listUnsubscribeHeaders(").length - 1, 2);
    assert.match(src, /createUnsubToken\(r\.email\)/);
    assert.match(src, /createUnsubToken\(toEmail\)/);
    assert.match(src, /buildUnsubscribeUrl\(row\.unsubToken, base\)/);
  });
});
