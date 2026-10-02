import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  signupEmailBlockReason,
  SIGNUP_EMAIL_REJECTION_MESSAGE,
} from "./signup-email";

describe("signupEmailBlockReason", () => {
  it("rejects the dotted-Gmail bot examples", () => {
    for (const email of [
      "ja.f.iz.a.k.o207@gmail.com",
      "w.ar.e.q.i.nib.0.8@gmail.com",
      "w.ujona.k3.8.9@gmail.com",
    ]) {
      assert.equal(signupEmailBlockReason(email), "dotted-gmail");
    }
  });

  it("rejects the same pattern on googlemail and with a plus tag", () => {
    assert.equal(
      signupEmailBlockReason("JA.F.IZ.A.K.O207@GoogleMail.com"),
      "dotted-gmail"
    );
    assert.equal(
      signupEmailBlockReason("w.ujona.k3.8.9+bot@gmail.com"),
      "dotted-gmail"
    );
  });

  it("rejects many 1–2 character segments even under the dot threshold", () => {
    // Three dots, four single-character segments.
    assert.equal(signupEmailBlockReason("a.b.c.d@gmail.com"), "dotted-gmail");
    assert.equal(
      signupEmailBlockReason("ab.cd.ef.gh@gmail.com"),
      "dotted-gmail"
    );
  });

  it("allows ordinary Gmail addresses, including a few dots and initials", () => {
    for (const email of [
      "jane.doe@gmail.com",
      "firstname.lastname@gmail.com",
      "Jane.Doe@Gmail.com",
      "john.q.public@gmail.com",
      "j.r.r.tolkien@gmail.com",
      "mary.jane.watson.parker@gmail.com",
      "jane.doe+training@gmail.com",
      "jdoe@gmail.com",
    ]) {
      assert.equal(signupEmailBlockReason(email), null);
    }
  });

  it("does not apply the dotted rule outside Gmail", () => {
    assert.equal(signupEmailBlockReason("a.b.c.d.e@yahoo.com"), null);
    assert.equal(signupEmailBlockReason("w.ujona.k3.8.9@outlook.com"), null);
  });

  it("rejects known disposable domains and their subdomains", () => {
    assert.equal(
      signupEmailBlockReason("bot@mailinator.com"),
      "disposable"
    );
    assert.equal(
      signupEmailBlockReason("bot@guerrillamail.com"),
      "disposable"
    );
    assert.equal(signupEmailBlockReason("bot@yopmail.com"), "disposable");
    assert.equal(
      signupEmailBlockReason("bot@foo.mailinator.com"),
      "disposable"
    );
    assert.equal(
      signupEmailBlockReason("bot@dept.33mail.com"),
      "disposable"
    );
  });

  it("allows agency and ordinary personal domains", () => {
    for (const email of [
      "officer@agency.gov",
      "officer@ci.fbi.gov",
      "soldier@army.mil",
      "analyst@defence.gov.uk",
      "contact@mail.mil",
      "jane.doe@yahoo.com",
      "jane.doe@outlook.com",
      "jane.doe@proton.me",
    ]) {
      assert.equal(signupEmailBlockReason(email), null);
    }
  });

  it("leaves malformed input to the register schema", () => {
    assert.equal(signupEmailBlockReason("not-an-email"), null);
    assert.equal(signupEmailBlockReason(""), null);
  });
});

describe("SIGNUP_EMAIL_REJECTION_MESSAGE", () => {
  it("is a user-facing message without rule internals", () => {
    assert.match(SIGNUP_EMAIL_REJECTION_MESSAGE, /can't be used to register/i);
    assert.equal(
      /disposable|dotted|heuristic|blocklist|gmail/i.test(
        SIGNUP_EMAIL_REJECTION_MESSAGE
      ),
      false
    );
  });
});
