import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMerge,
  fillFullHtml,
  parseRecipientRows,
  hasMergeTags,
  isFullHtmlDocument,
  greetingNameFrom,
  cleanAgency,
} from "./campaign-merge";

test("applyMerge substitutes first name, escapes html, falls back", () => {
  assert.equal(applyMerge("Hi {{first_name}},", { firstName: "Bill" }), "Hi Bill,");
  assert.equal(applyMerge("Hi {{ First_Name }},", { firstName: "" }), "Hi there,");
  assert.equal(applyMerge("Hi {{first_name|Officer}},", { firstName: " " }), "Hi Officer,");
  assert.equal(applyMerge("Hi {{firstName}}", { firstName: "<b>" }), "Hi &lt;b&gt;");
  assert.equal(applyMerge("Hi {{first_name}}", { firstName: "A&B" }, "text"), "Hi A&B");
  assert.equal(applyMerge("Hello {{first_name|}},", { firstName: "" }), "Hello,");
  assert.equal(applyMerge("Hello {{ first_name | }},", { firstName: "Paula" }), "Hello Paula,");
  assert.ok(hasMergeTags("x {{first_name}}"));
  assert.ok(!hasMergeTags("x {{last_name}}"));
});

test("fillFullHtml fills placeholders or injects footer", () => {
  const doc = `<html><body><a href="[UNSUBSCRIBE LINK]">u</a> [MAILING ADDRESS]</body></html>`;
  const out = fillFullHtml(doc, { unsubscribeUrl: "https://x/u?token=1&a=2", address: "1 Main St" });
  assert.match(out, /href="https:\/\/x\/u\?token=1&amp;a=2"/);
  assert.match(out, /1 Main St/);
  assert.doesNotMatch(out, /Unsubscribe<\/a><\/div>/);

  const bare = fillFullHtml("<html><body>hi</body></html>", { unsubscribeUrl: "https://x/u", address: "1 Main" });
  assert.match(bare, /Unsubscribe<\/a><\/div><\/body>/);
  assert.ok(isFullHtmlDocument("<!DOCTYPE html><html lang=en>"));
  assert.ok(!isFullHtmlDocument("<p>hi</p>"));
});

test("parseRecipientRows maps sheet headers, dedupes, skips blanks", () => {
  const rows = [
    ["tier", "contact_name", "first_name", "email"],
    ["1", "", "Registration Team", "SOR@Alaska.gov"],
    ["1", "Bill Smith", "", "bill@x.gov"],
    ["2", "", "", ""],
    ["2", "", "Dup", "sor@alaska.gov"],
    ["2", "", "", "not-an-email"],
    ["2", "", "", "anon@x.gov"],
  ];
  const r = parseRecipientRows(rows);
  assert.equal(r.error, undefined);
  assert.deepEqual(
    r.entries.map((e) => [e.email, e.firstName]),
    [
      ["sor@alaska.gov", "Registration Team"],
      ["bill@x.gov", "Bill"],
      ["anon@x.gov", ""],
    ]
  );
  assert.equal(r.duplicates, 1);
  assert.equal(r.skippedNoEmail, 2);
  assert.equal(r.blankFirstName, 1);
  assert.ok(parseRecipientRows([["name"], ["x"]]).error);
});

test("liquid-style defaults, agency tag, placeholder aliases", () => {
  const g = `{{first_name | default: "Detective"}},`;
  assert.equal(applyMerge(g, { firstName: "Dana" }), "Dana,");
  assert.equal(applyMerge(g, { firstName: "" }), "Detective,");
  assert.equal(applyMerge("like {{agency}}.", { agency: "Boaz Police Department" }), "like Boaz Police Department.");
  assert.equal(applyMerge("like {{agency}}.", {}), "like your agency.");
  assert.equal(applyMerge("at {{agency}}", { agency: "Sheriff's & Co" }), "at Sheriff's &amp; Co");
  const out = fillFullHtml(`<html><body><a href="{{unsubscribe_link}}">u</a>{{postal_address}}</body></html>`, {
    unsubscribeUrl: "https://x/u",
    address: "1 Main",
  });
  assert.match(out, /href="https:\/\/x\/u"/);
  assert.match(out, /1 Main<\/body>/);
});

test("greetingNameFrom handles messy LE contact names", () => {
  const cases: [string, string, string][] = [
    ["Dustin Baker", "", "Dustin"],
    ["(Investigations)", "", ""],
    ["Det. Frias", "", "Detective Frias"],
    ["Lt. Molder", "", "Lieutenant Molder"],
    ["Sgt. Sanchez", "Detective", "Sergeant Sanchez"],
    ["D. Robertson", "Detective", "Detective Robertson"],
    ["D. Robertson", "", ""],
    ["S. L. Entrekin", "Detective Sergeant", "Sergeant Entrekin"],
    ["J. Michael Sesher", "", "Michael"],
    ["Fields, Twandy", "", "Twandy"],
    ["Joseph J. Rudner Jr.", "", "Joseph"],
    ["J. Cedillo / D. Parr / J. Mijares", "Detective", ""],
  ];
  for (const [n, t, want] of cases) assert.equal(greetingNameFrom(n, t), want, n);
  assert.equal(cleanAgency("Boaz PD"), "Boaz Police Department");
  assert.equal(cleanAgency("Montgomery County Sheriff's Office (KY)"), "Montgomery County Sheriff's Office");
  assert.equal(cleanAgency("Davison (City) PD"), "Davison Police Department");
});
