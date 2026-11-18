import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { createUnsubToken } from "./unsub-token";
import {
  drainPendingUnsubscribes,
  handleUnsubscribe,
  isConfirmPost,
  isMailboxOneClickAgent,
  isOneClickPost,
  looksLikePrefetch,
  type UnsubscribeBackend,
  type UnsubscribeRequest,
} from "./unsubscribe";
import {
  defaultJournalPath,
  listPending,
  rememberPending,
} from "./unsubscribe-journal";

const SECRET = "test-unsubscribe-secret";

function headers(init: Record<string, string> = {}) {
  const lower = new Map(
    Object.entries(init).map(([key, value]) => [key.toLowerCase(), value])
  );
  return { get: (name: string) => lower.get(name.toLowerCase()) ?? null };
}

function request(partial: Partial<UnsubscribeRequest> & Pick<UnsubscribeRequest, "method" | "url">): UnsubscribeRequest {
  return { headers: headers(), body: "", ...partial };
}

async function tempJournal() {
  const dir = await mkdtemp(path.join(tmpdir(), "unsub-"));
  return {
    journalPath: path.join(dir, "journal.jsonl"),
    async cleanup() {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

function recorded() {
  const lines: string[] = [];
  const suppressed: string[] = [];
  return {
    lines,
    suppressed,
    log(_level: "info" | "error", line: string) {
      lines.push(line);
    },
    parsed() {
      return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    },
  };
}

describe("request classification", () => {
  it("recognizes one-click bodies, confirm posts, mailbox agents, and prefetches", () => {
    assert.equal(isOneClickPost("List-Unsubscribe=One-Click"), true);
    assert.equal(isOneClickPost("list-unsubscribe=one-click"), true);
    assert.equal(isOneClickPost("token=abc&List-Unsubscribe=One-Click"), true);
    assert.equal(isOneClickPost("confirm=1"), false);
    assert.equal(isOneClickPost(""), false);
    assert.equal(isConfirmPost("confirm=1&token=abc"), true);
    assert.equal(isConfirmPost("confirm=0"), false);
    assert.equal(isMailboxOneClickAgent("Mozilla/5.0 Microsoft.OWS.Api/1.0"), true);
    assert.equal(isMailboxOneClickAgent("Proofpoint"), false);
    assert.equal(looksLikePrefetch(headers({ purpose: "prefetch" })), true);
    assert.equal(looksLikePrefetch(headers({ "user-agent": "Proofpoint Scanner" })), true);
    assert.equal(
      looksLikePrefetch(headers({ "user-agent": "Microsoft.OWS.Api" })),
      false
    );
  });
});

describe("GET confirmation", () => {
  it("does not unsubscribe, including scanner prefetches, and logs the token", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const bag = recorded();
    let lookups = 0;
    const backend: UnsubscribeBackend = {
      async findEmailByToken() {
        lookups += 1;
        throw new Error("database should not be touched");
      },
      async suppress() {
        throw new Error("database should not be touched");
      },
    };
    try {
      const token = createUnsubToken("Ada&<script>@Example.com", SECRET);
      const res = await handleUnsubscribe(
        request({
          method: "GET",
          url: `https://inv.example/api/unsubscribe?token=${encodeURIComponent(token)}`,
          headers: headers({ purpose: "prefetch", "user-agent": "Proofpoint" }),
        }),
        { backend, journalPath, secret: SECRET, log: bag.log }
      );
      assert.equal(res.status, 200);
      assert.match(res.headers["Content-Type"], /text\/html/);
      assert.match(res.body, /Confirm unsubscribe/);
      assert.match(res.body, /does not unsubscribe you/);
      assert.match(res.body, /method="post"/);
      assert.equal(res.body.includes(`value="${token}"`), true);
      assert.equal(res.body.includes("<script>"), false);
      assert.equal(res.body.includes("ada&amp;&lt;script&gt;@example.com"), true);
      assert.doesNotMatch(res.body, /You&#39;re unsubscribed/);
      assert.equal(lookups, 0);
      await assert.rejects(readFile(journalPath), { code: "ENOENT" });
      const logged = bag.parsed();
      assert.equal(logged.length, 1);
      assert.equal(logged[0].event, "unsubscribe");
      assert.equal(logged[0].outcome, "confirm");
      assert.equal(logged[0].token, token);
      assert.equal(logged[0].email, "ada&<script>@example.com");
      assert.equal(logged[0].prefetch, true);
      assert.equal(bag.lines[0].includes("\n"), false);
    } finally {
      await cleanup();
    }
  });

  it("keeps a legacy inbox link usable without applying it", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const token = "ab".repeat(18);
    try {
      const res = await handleUnsubscribe(
        request({
          method: "GET",
          url: `https://inv.example/api/unsubscribe?token=${token}`,
        }),
        {
          backend: {
            async findEmailByToken() {
              throw new Error("Engine is not yet connected");
            },
            async suppress() {
              throw new Error("no");
            },
          },
          journalPath,
          secret: SECRET,
          log() {},
        }
      );
      assert.equal(res.status, 200);
      assert.match(res.body, /Confirm unsubscribe/);
      assert.equal(res.body.includes(`value="${token}"`), true);
      assert.doesNotMatch(res.body, /server error/i);
    } finally {
      await cleanup();
    }
  });

  it("rejects a missing token without echoing it", async () => {
    const res = await handleUnsubscribe(
      request({
        method: "GET",
        url: "https://inv.example/api/unsubscribe?token=%3Cscript%3E",
      }),
      { secret: SECRET, log() {} }
    );
    assert.equal(res.status, 200);
    assert.match(res.body, /missing its token/);
    assert.equal(res.body.includes("<script>"), false);
  });
});

describe("POST opt-out", () => {
  it("applies a confirm click and a one-click POST, lowercasing the address", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const bag = recorded();
    const token = createUnsubToken("Ada@Example.com", SECRET);
    const backend: UnsubscribeBackend = {
      async findEmailByToken() {
        throw new Error("sealed tokens do not need a lookup");
      },
      async suppress(email) {
        bag.suppressed.push(email);
      },
    };
    try {
      const confirm = await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${encodeURIComponent(token)}`,
          body: `confirm=1&token=${encodeURIComponent(token)}`,
          headers: headers({ "user-agent": "Mozilla/5.0" }),
        }),
        { backend, journalPath, secret: SECRET, log: bag.log }
      );
      assert.equal(confirm.status, 200);
      assert.match(confirm.headers["Content-Type"], /text\/html/);
      assert.match(confirm.body, /You&#39;re unsubscribed/);
      assert.match(confirm.body, /ada@example\.com/);
      assert.deepEqual(bag.suppressed, ["ada@example.com"]);

      const oneClick = await handleUnsubscribe(
        request({
          method: "POST",
          url: "https://inv.example/api/unsubscribe",
          body: `token=${encodeURIComponent(token)}&List-Unsubscribe=One-Click`,
          headers: headers({ "user-agent": "Microsoft.OWS.Api" }),
        }),
        { backend, journalPath, secret: SECRET, log: bag.log }
      );
      assert.equal(oneClick.status, 200);
      assert.equal(oneClick.headers["Content-Type"], "application/json");
      assert.deepEqual(JSON.parse(oneClick.body), { ok: true });
      assert.equal(bag.suppressed.length, 2);
      const text = await readFile(journalPath, "utf8").catch(() => "");
      assert.equal(text.includes(token), false);
      const applied = bag.parsed().filter((row) => row.outcome === "applied");
      assert.equal(applied.length, 2);
      assert.equal(applied[0].token, token);
      assert.equal(applied[0].email, "ada@example.com");
    } finally {
      await cleanup();
    }
  });

  it("honors Outlook one-click even when the form body was dropped", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const suppressed: string[] = [];
    const token = "cd".repeat(18);
    try {
      const res = await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${token}`,
          body: "",
          headers: headers({ "user-agent": "Microsoft Office Outlook Microsoft.OWS.Api" }),
        }),
        {
          backend: {
            async findEmailByToken() {
              return "Person@Example.com";
            },
            async suppress(email) {
              suppressed.push(email);
            },
          },
          journalPath,
          secret: SECRET,
          log() {},
        }
      );
      assert.equal(res.status, 200);
      assert.deepEqual(JSON.parse(res.body), { ok: true });
      assert.deepEqual(suppressed, ["person@example.com"]);
    } finally {
      await cleanup();
    }
  });

  it("ignores a POST that is neither a confirm nor one-click", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const bag = recorded();
    let suppressed = 0;
    const token = "ef".repeat(18);
    try {
      const res = await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${token}`,
          body: "",
          headers: headers({ "user-agent": "Proofpoint" }),
        }),
        {
          backend: {
            async findEmailByToken() {
              return "a@b.com";
            },
            async suppress() {
              suppressed += 1;
            },
          },
          journalPath,
          secret: SECRET,
          log: bag.log,
        }
      );
      assert.equal(res.status, 200);
      assert.deepEqual(JSON.parse(res.body), { ok: true });
      assert.equal(suppressed, 0);
      assert.equal(bag.parsed()[0].outcome, "ignored");
      assert.equal(bag.parsed()[0].token, token);
      await assert.rejects(readFile(journalPath), { code: "ENOENT" });
    } finally {
      await cleanup();
    }
  });

  it("returns 400 when the token is missing", async () => {
    const res = await handleUnsubscribe(
      request({ method: "POST", url: "https://inv.example/api/unsubscribe", body: "confirm=1" }),
      { secret: SECRET, log() {} }
    );
    assert.equal(res.status, 400);
    assert.match(res.body, /Missing token/);
  });
});

describe("database outage", () => {
  it("queues a legacy token, logs it, and shows a received page instead of an error", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const bag = recorded();
    const token = "12".repeat(18);
    try {
      const res = await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${token}`,
          body: "confirm=1",
        }),
        {
          backend: {
            async findEmailByToken() {
              throw new Error("Engine is not yet connected");
            },
            async suppress() {
              throw new Error("should wait for the lookup");
            },
          },
          journalPath,
          secret: SECRET,
          log: bag.log,
        }
      );
      assert.equal(res.status, 200);
      assert.match(res.body, /Request received/);
      assert.match(res.body, /will be processed/);
      assert.doesNotMatch(res.body, /server error|exception|Engine is not/i);
      const result = bag.parsed().find((row) => row.phase === "result");
      assert.equal(result?.outcome, "queued");
      assert.equal(result?.token, token);
      assert.equal(result?.journal, "persisted");
      assert.match(String(result?.error), /not yet connected/);
      assert.equal(bag.lines.every((line) => !line.includes("\n")), true);
      const stored = JSON.parse(await readFile(journalPath, "utf8"));
      assert.equal(stored.token, token);
      assert.equal(stored.email, null);
    } finally {
      await cleanup();
    }
  });

  it("records the sealed address before the database write and replays it", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const secret = SECRET;
    const token = createUnsubToken("Replay@Example.com", secret);
    const bag = recorded();
    try {
      const queued = await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${encodeURIComponent(token)}`,
          body: "List-Unsubscribe=One-Click",
          headers: headers({ "user-agent": "Microsoft.OWS.Api" }),
        }),
        {
          backend: {
            async findEmailByToken() {
              throw new Error("lookup should not run");
            },
            async suppress() {
              throw Object.assign(new Error("Can't reach database server"), { code: "P1001" });
            },
          },
          journalPath,
          secret,
          log: bag.log,
        }
      );
      assert.equal(queued.status, 200);
      assert.deepEqual(JSON.parse(queued.body), { ok: true });
      const stored = JSON.parse(await readFile(journalPath, "utf8"));
      assert.equal(stored.email, "replay@example.com");
      assert.equal(stored.token, token);

      let lookups = 0;
      const drained = await drainPendingUnsubscribes({
        backend: {
          async findEmailByToken() {
            lookups += 1;
            return null;
          },
          async suppress(email) {
            bag.suppressed.push(email);
          },
        },
        journalPath,
        secret,
        log: bag.log,
      });
      assert.equal(drained.applied, 1);
      assert.equal(drained.pending, 0);
      assert.equal(lookups, 0);
      assert.deepEqual(bag.suppressed, ["replay@example.com"]);
      const again = await drainPendingUnsubscribes({
        backend: {
          async findEmailByToken() {
            throw new Error("empty queue");
          },
          async suppress() {
            throw new Error("empty queue");
          },
        },
        journalPath,
        secret,
        log() {},
      });
      assert.deepEqual(again, { applied: 0, dropped: 0, pending: 0 });
    } finally {
      await cleanup();
    }
  });

  it("resolves a legacy token on the next healthy pass and then drops unknowns", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const token = "98".repeat(18);
    const unknown = "76".repeat(18);
    try {
      await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${token}`,
          body: "List-Unsubscribe=One-Click",
        }),
        {
          backend: {
            async findEmailByToken() {
              throw new Error("Engine is not yet connected");
            },
            async suppress() {
              throw new Error("no");
            },
          },
          journalPath,
          secret: SECRET,
          log() {},
        }
      );
      await rememberPending(journalPath, {
        token: unknown,
        email: null,
        via: "one-click",
        at: "2026-11-16T00:00:00.000Z",
      });

      const stillDown = await drainPendingUnsubscribes({
        backend: {
          async findEmailByToken() {
            throw new Error("Engine is not yet connected");
          },
          async suppress() {
            throw new Error("no");
          },
        },
        journalPath,
        secret: SECRET,
        log() {},
      });
      assert.equal(stillDown.applied, 0);
      assert.equal(stillDown.pending >= 1, true);

      const suppressed: string[] = [];
      const drained = await drainPendingUnsubscribes({
        backend: {
          async findEmailByToken(value) {
            if (value === token) return "Legacy@Example.com";
            return null;
          },
          async suppress(email) {
            suppressed.push(email);
          },
        },
        journalPath,
        secret: SECRET,
        log() {},
      });
      assert.equal(drained.applied, 1);
      assert.equal(drained.dropped, 1);
      assert.equal(drained.pending, 0);
      assert.deepEqual(suppressed, ["legacy@example.com"]);
      const left = await listPending(journalPath);
      assert.deepEqual(left, []);
    } finally {
      await cleanup();
    }
  });

  it("saves a resolved address when the suppression write is the call that fails", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const token = "54".repeat(18);
    try {
      const res = await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${token}`,
          body: "confirm=1",
        }),
        {
          backend: {
            async findEmailByToken() {
              return "Kept@Example.com";
            },
            async suppress() {
              throw new Error("Connection terminated unexpectedly");
            },
          },
          journalPath,
          secret: SECRET,
          log() {},
          deadlineMs: 1000,
        }
      );
      assert.equal(res.status, 200);
      assert.match(res.body, /will be processed/);
      const stored = JSON.parse(await readFile(journalPath, "utf8"));
      assert.equal(stored.email, "kept@example.com");
    } finally {
      await cleanup();
    }
  });

  it("answers before a hung database and still keeps the token", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const token = "32".repeat(18);
    const bag = recorded();
    try {
      const res = await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${token}`,
          body: "confirm=1",
        }),
        {
          backend: {
            findEmailByToken: () => new Promise(() => {}),
            async suppress() {
              throw new Error("no");
            },
          },
          journalPath,
          secret: SECRET,
          log: bag.log,
          deadlineMs: 40,
        }
      );
      assert.equal(res.status, 200);
      assert.match(res.body, /Request received/);
      assert.equal(bag.parsed().find((row) => row.outcome === "queued")?.token, token);
      const stored = JSON.parse(await readFile(journalPath, "utf8"));
      assert.equal(stored.token, token);
    } finally {
      await cleanup();
    }
  });

  it("still logs the token when the journal cannot accept more records", async () => {
    const { journalPath, cleanup } = await tempJournal();
    const bag = recorded();
    const token = createUnsubToken("capped@example.com", SECRET);
    try {
      const res = await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${encodeURIComponent(token)}`,
          body: "confirm=1",
        }),
        {
          backend: {
            async findEmailByToken() {
              throw new Error("down");
            },
            async suppress() {
              throw new Error("down");
            },
          },
          journalPath,
          secret: SECRET,
          log: bag.log,
          maxPending: 0,
        }
      );
      assert.equal(res.status, 200);
      const result = bag.parsed().find((row) => row.outcome === "queued");
      assert.equal(result?.journal, "full");
      assert.equal(result?.token, token);
      assert.equal(result?.email, "capped@example.com");
    } finally {
      await cleanup();
    }
  });

  it("keeps an in-memory copy when the journal path is not a directory", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "unsub-"));
    const blocker = path.join(dir, "not-a-directory");
    await writeFile(blocker, "x");
    const journalPath = path.join(blocker, "journal.jsonl");
    const token = createUnsubToken("memory@example.com", SECRET);
    const suppressed: string[] = [];
    try {
      const res = await handleUnsubscribe(
        request({
          method: "POST",
          url: `https://inv.example/api/unsubscribe?token=${encodeURIComponent(token)}`,
          body: "List-Unsubscribe=One-Click",
        }),
        {
          backend: {
            async findEmailByToken() {
              throw new Error("no");
            },
            async suppress() {
              throw new Error("Engine is not yet connected");
            },
          },
          journalPath,
          secret: SECRET,
          log() {},
        }
      );
      assert.equal(res.status, 200);
      const drained = await drainPendingUnsubscribes({
        backend: {
          async findEmailByToken() {
            throw new Error("should use the sealed address");
          },
          async suppress(email) {
            suppressed.push(email);
          },
        },
        journalPath,
        secret: SECRET,
        log() {},
      });
      assert.equal(drained.applied, 1);
      assert.deepEqual(suppressed, ["memory@example.com"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("journal durability", () => {
  it("keeps both records when two writers commit at once", async () => {
    const { journalPath, cleanup } = await tempJournal();
    try {
      const [a, b] = await Promise.all([
        rememberPending(journalPath, {
          token: "a".repeat(36),
          email: "a@example.com",
          via: "confirm",
          at: "t",
        }),
        rememberPending(journalPath, {
          token: "b".repeat(36),
          email: null,
          via: "one-click",
          at: "t",
        }),
      ]);
      assert.equal(a, "persisted");
      assert.equal(b, "persisted");
      const pending = await listPending(journalPath);
      assert.deepEqual(
        pending.map((row) => row.token).sort(),
        ["a".repeat(36), "b".repeat(36)]
      );
    } finally {
      await cleanup();
    }
  });

  it("defaults the journal onto the upload directory", () => {
    assert.equal(
      defaultJournalPath({ UNSUBSCRIBE_JOURNAL_PATH: "/data/unsub.jsonl" } as NodeJS.ProcessEnv),
      "/data/unsub.jsonl"
    );
    assert.equal(
      defaultJournalPath({ UPLOAD_DIR: "/data/uploads" } as NodeJS.ProcessEnv),
      path.join("/data/uploads", "unsubscribe-journal.jsonl")
    );
  });
});

describe("wiring", () => {
  it("suppresses contacts without deleting user accounts or blocking transactional mail", () => {
    const db = readFileSync(new URL("./unsubscribe-db.ts", import.meta.url), "utf8");
    assert.match(db, /reason:\s*"UNSUBSCRIBE"/);
    assert.match(db, /status:\s*"UNSUBSCRIBED"/);
    assert.doesNotMatch(db, /prisma\.user/);
    assert.doesNotMatch(db, /user\.delete/);
    const email = readFileSync(new URL("./email.ts", import.meta.url), "utf8");
    assert.doesNotMatch(email, /suppression/i);
    assert.doesNotMatch(email, /UNSUBSCRIBED/);
  });

  it("replays from the process start, the health check, and the campaign cron", () => {
    const boot = readFileSync(new URL("../instrumentation.ts", import.meta.url), "utf8");
    assert.match(boot, /startUnsubscribeReconciler/);
    const health = readFileSync(new URL("../app/api/health/route.ts", import.meta.url), "utf8");
    assert.match(health, /drainPendingUnsubscribes/);
    assert.match(health, /\{\s*ok:\s*true\s*\}/);
    const cron = readFileSync(
      new URL("../app/api/cron/send-scheduled/route.ts", import.meta.url),
      "utf8"
    );
    assert.match(cron, /drainPendingUnsubscribes/);
  });
});
