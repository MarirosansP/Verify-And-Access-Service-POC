// verify-gateway/src/index.js
//
// Fix: Do NOT spread a proxy middleware function into createProxyMiddleware()
// Instead: keep a base OPTIONS object (with target), then create middleware instances from it.
//
// Also: avoid consuming the request body before proxying.
// We DO NOT apply express.json() on the proxy routes. Proxy streams request through.
//
// Env:
//   PORT (default 3002)
//   CONSOLE_BASE_URL (default http://console-web:3001)
//   VERIFIER_BASE_URL (default http://credential-verifier:8000)
//   REQUEST_TIMEOUT_MS (default 20000)
//   USAGE_SHARED_SECRET (optional)

import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { createProxyMiddleware } from "http-proxy-middleware";
import fetch from "node-fetch";

const PORT = Number(process.env.PORT || 3002);
const CONSOLE_BASE_URL = (process.env.CONSOLE_BASE_URL || "http://console-web:3001").replace(/\/$/, "");
const VERIFIER_BASE_URL = (process.env.VERIFIER_BASE_URL || "http://credential-verifier:8000").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
const USAGE_SHARED_SECRET = process.env.USAGE_SHARED_SECRET || "";

const app = express();

app.use(helmet());

// Small request log (helps confirm requests hit the gateway)
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

async function introspect(apiKey) {
  const r = await fetch(`${CONSOLE_BASE_URL}/api/internal/introspect`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });

  if (!r.ok) return { valid: false };
  return r.json();
}

async function reportUsage(payload) {
  if (!USAGE_SHARED_SECRET) return;
  try {
    await fetch(`${CONSOLE_BASE_URL}/api/internal/usage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, sharedSecret: USAGE_SHARED_SECRET }),
    });
  } catch {
    // ignore usage failures
  }
}

async function apiKeyGuard(req, res, next) {
  const apiKey = req.header("X-API-Key") || req.header("x-api-key");
  if (!apiKey) return res.status(401).json({ error: "missing_api_key" });

  let info;
  try {
    info = await introspect(apiKey);
  } catch (e) {
    console.error("introspection_failed", e?.message || e);
    return res.status(502).json({ error: "introspection_failed" });
  }

  if (!info?.valid) return res.status(401).json({ error: "invalid_api_key" });
  if (info.status && info.status !== "active") {
    return res.status(403).json({ error: "api_key_not_active", status: info.status });
  }

  req.apiAuth = info;
  next();
}

function withUsage(endpointName) {
  return (req, res, next) => {
    const start = Date.now();
    const merchantOrigin = req.header("X-Merchant-Origin") || undefined;

    res.on("finish", () => {
      reportUsage({
        userId: req.apiAuth?.userId,
        apiKeyId: req.apiAuth?.apiKeyId,
        endpoint: endpointName,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        merchantOrigin,
      });
    });

    next();
  };
}

// ---- PROXY OPTIONS (IMPORTANT: this object includes target) ----
const verifierProxyOpts = {
  target: VERIFIER_BASE_URL,
  changeOrigin: true,
  selfHandleResponse: false,
  proxyTimeout: REQUEST_TIMEOUT_MS,
  timeout: REQUEST_TIMEOUT_MS,

  // Surface proxy errors as JSON
  onError: (err, _req, res) => {
    console.error("proxy_error:", err?.code || err?.message || err);
    if (!res.headersSent) {
      res.status(502).json({ error: "proxy_error", code: err?.code || "unknown" });
    }
  },
};

// Direct proxy (no rewrite)
const proxyToVerifier = createProxyMiddleware(verifierProxyOpts);

// Rewritten proxies (v1 -> non-v1)
const proxyCreateV1 = createProxyMiddleware({
  ...verifierProxyOpts,
  pathRewrite: {
    "^/v1/verifiable-presentations/create-verification-request$":
      "/verifiable-presentations/create-verification-request",
  },
});

const proxyVerifyV1 = createProxyMiddleware({
  ...verifierProxyOpts,
  pathRewrite: {
    "^/v1/verifiable-presentations/verify$": "/verifiable-presentations/verify",
  },
});

// ---- ROUTES ----
app.post(
  "/v1/verifiable-presentations/create-verification-request",
  apiKeyGuard,
  withUsage("create-vpr"),
  proxyCreateV1
);

app.post(
  "/verifiable-presentations/create-verification-request",
  apiKeyGuard,
  withUsage("create-vpr"),
  proxyToVerifier
);

app.post("/v1/verifiable-presentations/verify", apiKeyGuard, withUsage("verify"), proxyVerifyV1);

app.post("/verifiable-presentations/verify", apiKeyGuard, withUsage("verify"), proxyToVerifier);

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    verifierBase: VERIFIER_BASE_URL,
    routes: [
      "GET /health",
      "POST /v1/verifiable-presentations/create-verification-request",
      "POST /v1/verifiable-presentations/verify",
      "POST /verifiable-presentations/create-verification-request",
      "POST /verifiable-presentations/verify",
    ],
  });
});

app.use((_req, res) => res.status(404).json({ error: "not_found" }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`verify-gateway listening on :${PORT}`);
});
