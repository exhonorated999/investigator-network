import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const BASE = `http://localhost:${process.env.APP_PORT ?? 3087}`;

async function jarFetch(url, opts = {}, jar = {}) {
  const cookie = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(url, { ...opts, redirect: "manual", headers: { ...(opts.headers || {}), ...(cookie ? { cookie } : {}) } });
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar[pair.slice(0, i)] = pair.slice(i + 1);
  }
  return res;
}
async function login(email, password, jar) {
  const csrf = await (await jarFetch(`${BASE}/api/auth/csrf`, {}, jar)).json();
  const body = new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${BASE}/dashboard` });
  await jarFetch(`${BASE}/api/auth/callback/credentials`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }, jar);
}
const strip = (s) => s.replaceAll("<!-- -->", "");

const r = {};
const admin = await p.user.findUnique({ where: { email: "admin@investigator-network.com" } });
const learner = await p.user.findUnique({ where: { email: "learner@investigator-network.com" } });
r.have_accounts = !!(admin && learner);

const jar = {};
await login("admin@investigator-network.com", "ChangeMe#12345", jar);
r.admin_session = !!(jar["authjs.session-token"] || jar["__Secure-authjs.session-token"]);

// Preview picker lists the demo learner
const picker = strip(await (await jarFetch(`${BASE}/admin/preview`, {}, jar)).text());
r.picker_lists_learner = picker.includes("Dana Reyes") && picker.includes("View as");

// Admin normally on /dashboard sees own (admin) dashboard, no preview banner
const adminDash = strip(await (await jarFetch(`${BASE}/dashboard`, {}, jar)).text());
r.admin_dash_no_banner = !/previewing as/i.test(adminDash);

// Set preview cookie -> dashboard renders as the learner + banner
jar["preview_uid"] = learner.id;
const previewDash = strip(await (await jarFetch(`${BASE}/dashboard`, {}, jar)).text());
r.preview_banner = /previewing as/i.test(previewDash) && previewDash.includes("Dana Reyes");
r.preview_learner_course = previewDash.includes("Financial Crimes Investigation Fundamentals");
r.preview_available = previewDash.includes("Available");

// A non-admin cannot impersonate: learner jar with preview cookie set to admin id is ignored
const ljar = {};
await login("learner@investigator-network.com", "ChangeMe#12345", ljar);
ljar["preview_uid"] = admin.id;
const learnerDash = strip(await (await jarFetch(`${BASE}/dashboard`, {}, ljar)).text());
r.nonadmin_cannot_impersonate = learnerDash.includes("Dana Reyes") && !/previewing as/i.test(learnerDash);

console.log(JSON.stringify(r, null, 2));
console.log("PREVIEW_RESULT=" + (Object.values(r).every(Boolean) ? "PASS" : "FAIL"));
await p.$disconnect();
