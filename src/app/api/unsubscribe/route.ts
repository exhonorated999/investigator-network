import { NextResponse } from "next/server";
import {
  handleUnsubscribe,
  readUnsubscribeToken,
  type UnsubscribeResponse,
} from "@/lib/unsubscribe";

/**
 * Public unsubscribe endpoint. GET confirms; POST (button or RFC 8058
 * one-click) applies. The handler logs the token and, when Postgres is
 * down, queues the opt-out instead of returning 500.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[A-Za-z0-9._~-]{1,2000}$/;

function respond(result: UnsubscribeResponse) {
  return new NextResponse(result.body, {
    status: result.status,
    headers: result.headers,
  });
}

function logCrash(method: "GET" | "POST", url: string, body: string, err: unknown) {
  const token = readUnsubscribeToken(url, body);
  console.error(
    JSON.stringify({
      event: "unsubscribe",
      phase: "result",
      source: "request",
      method,
      token: TOKEN_RE.test(token) ? token : "",
      outcome: "queued",
      error: err instanceof Error ? err.message.slice(0, 200) : "error",
    })
  );
}

function received() {
  return new NextResponse("Request received. It will be processed shortly.", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  try {
    return respond(
      await handleUnsubscribe({
        method: "GET",
        url: req.url,
        headers: req.headers,
      })
    );
  } catch (err) {
    logCrash("GET", req.url, "", err);
    return received();
  }
}

export async function POST(req: Request) {
  const body = await req.text().catch(() => "");
  try {
    return respond(
      await handleUnsubscribe({
        method: "POST",
        url: req.url,
        body,
        headers: req.headers,
      })
    );
  } catch (err) {
    logCrash("POST", req.url, body, err);
    return received();
  }
}
