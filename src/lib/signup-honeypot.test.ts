import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HONEYPOT_FIELD,
  HONEYPOT_MESSAGE,
  honeypotFilled,
} from "./signup-honeypot";

describe("honeypotFilled", () => {
  it("ignores a missing or blank field", () => {
    assert.equal(HONEYPOT_FIELD, "company_url");
    assert.equal(honeypotFilled(null), false);
    assert.equal(honeypotFilled(undefined), false);
    assert.equal(honeypotFilled(""), false);
    assert.equal(honeypotFilled("   "), false);
  });

  it("trips when a bot fills the field", () => {
    assert.equal(honeypotFilled("https://spam.example"), true);
    assert.equal(honeypotFilled("NrdLQGrx"), true);
  });

  it("trips on an unexpected non-string value", () => {
    assert.equal(honeypotFilled(new Blob(["x"])), true);
  });
});

describe("HONEYPOT_MESSAGE", () => {
  it("does not name the field or the check", () => {
    assert.equal(/honeypot|company_url|bot|captcha/i.test(HONEYPOT_MESSAGE), false);
  });
});
