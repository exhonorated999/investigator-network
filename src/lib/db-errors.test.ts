import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  DB_MAX_RETRIES,
  DB_RETRY_BACKOFF_MS,
  briefDbError,
  isTransientDbError,
  retryTransient,
} from "./db-errors";

describe("isTransientDbError", () => {
  it("treats a disconnected query engine as transient", () => {
    const err = new Error(
      "Invalid `prisma.campaignRecipient.findFirst()` invocation:\n\nEngine is not yet connected."
    );
    err.name = "PrismaClientUnknownRequestError";
    assert.equal(isTransientDbError(err), true);
    assert.equal(
      isTransientDbError(new Error("Response from the Engine was empty")),
      true
    );
    assert.equal(isTransientDbError(new Error("Engine was closed.")), true);
  });

  it("treats Neon connection drops and pool timeouts as transient", () => {
    assert.equal(
      isTransientDbError(
        Object.assign(new Error("closed"), { code: "P1017" })
      ),
      true
    );
    assert.equal(
      isTransientDbError(
        Object.assign(new Error("unreachable"), { code: "P1001" })
      ),
      true
    );
    assert.equal(
      isTransientDbError(
        Object.assign(new Error("pool"), { errorCode: "P2024" })
      ),
      true
    );
    assert.equal(
      isTransientDbError(new Error("Server has closed the connection")),
      true
    );
    assert.equal(
      isTransientDbError(new Error("Can't reach database server at ep-example")),
      true
    );
    assert.equal(
      isTransientDbError(new Error("Timed out fetching a new connection from the connection pool")),
      true
    );
    assert.equal(isTransientDbError({ retryable: true, message: "init" }), true);
  });

  it("follows causes and batch error lists", () => {
    const cause = new Error("Connection terminated unexpectedly");
    assert.equal(isTransientDbError(new Error("query failed", { cause })), true);
    assert.equal(
      isTransientDbError({
        message: "batch failed",
        errors: [new Error("Unique constraint"), new Error("kind: Closed")],
      }),
      true
    );
  });

  it("does not retry constraint or application errors", () => {
    assert.equal(
      isTransientDbError(
        Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
      ),
      false
    );
    assert.equal(
      isTransientDbError(
        Object.assign(new Error("Record to update not found"), { code: "P2025" })
      ),
      false
    );
    assert.equal(isTransientDbError(new Error("Invalid signature")), false);
    assert.equal(isTransientDbError("nope"), false);
    assert.equal(isTransientDbError(null), false);
    assert.equal(isTransientDbError(undefined), false);
  });
});

describe("briefDbError", () => {
  it("keeps the cause line and drops the query payload", () => {
    const err = new Error(
      'Invalid `prisma.campaignRecipient.findFirst()` invocation:\n\n{\n  where: { providerId: "abc" },\n  select: { email: true }\n}\n\nEngine is not yet connected.'
    );
    assert.equal(briefDbError(err), "Engine is not yet connected.");
  });
});

describe("retryTransient", () => {
  it("reconnects and retries a not-yet-connected engine", async () => {
    const sleeps: number[] = [];
    let connects = 0;
    let calls = 0;
    const result = await retryTransient(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("Engine is not yet connected");
        return "ok";
      },
      async () => {
        connects += 1;
      },
      async (ms) => {
        sleeps.push(ms);
      }
    );
    assert.equal(result, "ok");
    assert.equal(calls, 3);
    assert.equal(connects, 2);
    assert.deepEqual(sleeps, [DB_RETRY_BACKOFF_MS, DB_RETRY_BACKOFF_MS * 2]);
  });

  it("reconnects on each failure and then gives up", async () => {
    let calls = 0;
    let connects = 0;
    await assert.rejects(
      () =>
        retryTransient(
          async () => {
            calls += 1;
            throw Object.assign(new Error("Server has closed the connection"), {
              code: "P1017",
            });
          },
          async () => {
            connects += 1;
          },
          async () => {}
        ),
      /closed the connection/
    );
    assert.equal(DB_MAX_RETRIES, 2);
    assert.equal(calls, DB_MAX_RETRIES + 1);
    // Reconnect after the final failure too, so the singleton is not left down.
    assert.equal(connects, DB_MAX_RETRIES + 1);
  });

  it("does not retry or reconnect ordinary failures", async () => {
    let calls = 0;
    let connects = 0;
    await assert.rejects(
      () =>
        retryTransient(
          async () => {
            calls += 1;
            throw Object.assign(new Error("Record not found"), { code: "P2025" });
          },
          async () => {
            connects += 1;
          },
          async () => {}
        ),
      /Record not found/
    );
    assert.equal(calls, 1);
    assert.equal(connects, 0);
  });

  it("still retries when reconnect itself throws", async () => {
    let calls = 0;
    const result = await retryTransient(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error("Engine is not yet connected");
        return "recovered";
      },
      async () => {
        throw new Error("connect failed");
      },
      async () => {}
    );
    assert.equal(result, "recovered");
    assert.equal(calls, 2);
  });
});

describe("shared Prisma client", () => {
  it("reconnects with $connect and does not disconnect the singleton", () => {
    const src = readFileSync(new URL("./prisma.ts", import.meta.url), "utf8");
    assert.match(src, /\$connect\(/);
    assert.match(src, /retryTransient\(/);
    assert.doesNotMatch(src, /\$disconnect\(/);
  });
});
