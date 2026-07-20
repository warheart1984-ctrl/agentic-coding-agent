import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Socket } from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import { escapeHtml, highlightJSON } from "../cockpit/src/panels/highlightJSON.ts";
import { upsertReceipt } from "../cockpit/src/state/receiptMerge.ts";
import {
  authorizeReceiptIngest,
  ingestToken,
  isLoopbackAddress,
} from "../backend/ingest-auth.ts";

describe("highlightJSON XSS safety", () => {
  it("escapes HTML in string values before highlighting", () => {
    const malicious = { note: "<img src=x onerror=alert(1)>" };
    const html = highlightJSON(malicious, {
      jsonKey: "key",
      jsonString: "str",
      jsonBool: "bool",
      jsonNum: "num",
      jsonNull: "null",
    });
    assert.ok(!html.includes("<img"));
    assert.ok(html.includes("&lt;img"));
    assert.equal(escapeHtml('<script>"x"</script>'), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  });
});

describe("addReceipt idempotency", () => {
  it("does not duplicate receipts or timeline nodes by id", () => {
    const receipt = {
      id: "receipt-dedup-test",
      timestamp: Date.now(),
      action: { type: "generate", payload: {} },
      invariantsChecked: [] as string[],
      continuityHash: "abc",
      ledgerHash: "def",
    };

    const first = upsertReceipt({ receipts: [] }, { timeline: [] }, receipt);
    const second = upsertReceipt(
      first.governance,
      first.continuity,
      { ...receipt, ledgerHash: "updated" },
    );

    assert.equal(second.governance.receipts.length, 1);
    assert.equal(second.governance.receipts[0]?.ledgerHash, "updated");
    assert.equal(
      second.continuity.timeline.filter((n) => n.id === receipt.id && n.type === "receipt").length,
      1,
    );
  });
});

describe("receipt ingest authorization", () => {
  function mockReq(remoteAddress: string, token?: string): IncomingMessage {
    const socket = new Socket();
    Object.defineProperty(socket, "remoteAddress", { value: remoteAddress });
    return {
      socket,
      headers: token ? { "x-nova-ingest-token": token } : {},
    } as IncomingMessage;
  }

  function mockRes(): ServerResponse & { status?: number; body?: string } {
    const res = {} as ServerResponse & { status?: number; body?: string };
    return res;
  }

  it("allows loopback in non-production when no token configured", () => {
    const prevEnv = process.env.NODE_ENV;
    const prevToken = process.env.NOVA_OBSERVE_TOKEN;
    delete process.env.NODE_ENV;
    delete process.env.NOVA_OBSERVE_TOKEN;
    delete process.env.NOVA_SPINE_INGEST_TOKEN;

    const req = mockReq("127.0.0.1");
    const res = mockRes();
    let status = 0;
    const ok = authorizeReceiptIngest(req, res, (s) => {
      status = s;
    });
    assert.equal(ok, true);
    assert.equal(status, 0);

    process.env.NODE_ENV = prevEnv;
    if (prevToken !== undefined) process.env.NOVA_OBSERVE_TOKEN = prevToken;
  });

  it("rejects non-loopback when no token configured outside production", () => {
    const prevEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    delete process.env.NOVA_OBSERVE_TOKEN;
    delete process.env.NOVA_SPINE_INGEST_TOKEN;

    const req = mockReq("10.0.0.5");
    const res = mockRes();
    let status = 0;
    const ok = authorizeReceiptIngest(req, res, (s) => {
      status = s;
    });
    assert.equal(ok, false);
    assert.equal(status, 403);

    process.env.NODE_ENV = prevEnv;
  });

  it("requires matching token when configured", () => {
    const prevToken = process.env.NOVA_OBSERVE_TOKEN;
    process.env.NOVA_OBSERVE_TOKEN = "secret-token";

    assert.equal(ingestToken(), "secret-token");
    assert.equal(isLoopbackAddress(mockReq("::1")), true);

    const req = mockReq("10.0.0.5", "wrong");
    let status = 0;
    const ok = authorizeReceiptIngest(req, mockRes(), (s) => {
      status = s;
    });
    assert.equal(ok, false);
    assert.equal(status, 401);

    if (prevToken === undefined) delete process.env.NOVA_OBSERVE_TOKEN;
    else process.env.NOVA_OBSERVE_TOKEN = prevToken;
  });
});
