import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GIBBERISH_AGENCY_MESSAGE,
  GIBBERISH_NAME_MESSAGE,
  isGibberishLabel,
} from "./signup-gibberish";

const ALLOWED = [
  "Jane Doe",
  "Mary Jane Watson",
  "José García",
  "Li Wei",
  "Madonna",
  "McDonald",
  "MacArthur",
  "O'Brien",
  "Mary-Jane Watson",
  "DeLaCruz",
  "MaryJaneWatson",
  "Los Angeles Police Department",
  "LosAngelesPoliceDepartment",
  "New York City Police Dept",
  "Department of Homeland Security",
  "Federal Bureau of Investigation",
  "Los Angeles County Sheriff's Department",
  "FBI",
  "LAPD",
  "St. Louis Metropolitan Police Department",
  "Jean-Luc Picard",
  "John Q. Public",
  "",
  "   ",
  "Precinct 12",
  "24th Precinct",
  "Okonkwo",
  "Schwarzenegger",
  "Christopher Michael Anderson",
  "McDonalds International",
  "counterintelligence",
  "INTERPOLWASHINGTON",
  "FBIFieldOfficeDallas",
  "McDonaldsInternational",
  "DeLaCruzInvestigations",
  "StLouisMetropolitanPoliceDepartment",
  "Nguyễn Văn A",
  "李伟",
  "Ana-María López",
  "d'Artagnan",
  "Jr.",
  "A. Smith",
  "iPhoneUserNameSomething",
  // Long single-case strings are not this bot shape. Turnstile still applies.
  "msceyawyyguewisiwsqmcc",
];

/** Irregular 1–3 letter case clumps, the shape in the pending-queue samples. */
function randomMixed(length: number, seed: number): string {
  let x = seed >>> 0;
  const next = () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x;
  };
  let out = "";
  let upper = (next() & 1) === 0;
  let run = 0;
  for (let i = 0; i < length; i++) {
    const letter = String.fromCharCode(65 + (next() % 26));
    out += upper ? letter : letter.toLowerCase();
    run++;
    if (run >= 1 + (next() % 3)) {
      upper = !upper;
      run = 0;
    }
  }
  return out;
}

describe("isGibberishLabel", () => {
  it("rejects the pending-queue bot names and agencies", () => {
    assert.equal(isGibberishLabel("NrdLQGrxBIAHtDcWyInobD"), true);
    assert.equal(isGibberishLabel("MEbMbgvMbFzAEwWhAqrByXn"), true);
  });

  it("rejects the same shape when a space or dot is inserted", () => {
    assert.equal(isGibberishLabel("NrdLQGrxBIAH tDcWyInobDxxxx"), true);
    assert.equal(isGibberishLabel("NrdLQGrx.BIAHtDcWyInobD"), true);
  });

  it("rejects random mixed-case tokens", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sample = randomMixed(22, seed);
      assert.equal(isGibberishLabel(sample), true, sample);
    }
  });

  it("allows ordinary names and agencies", () => {
    for (const value of ALLOWED) {
      assert.equal(isGibberishLabel(value), false, JSON.stringify(value));
    }
  });
});

describe("gibberish messages", () => {
  it("do not describe the heuristic", () => {
    for (const message of [GIBBERISH_NAME_MESSAGE, GIBBERISH_AGENCY_MESSAGE]) {
      assert.equal(/bot|gibberish|heuristic|random|captcha/i.test(message), false);
    }
  });
});
