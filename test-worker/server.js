/**
 * Test Worker Server
 * ------------------
 * A tiny Express server that:
 *  1. Serves the test-harness HTML page at /
 *  2. Acts as a "protected site" callback target (simulates the site
 *     that the CF Worker would protect)
 *
 * When the verified user is redirected back with ?va_session=...&va_status=verified,
 * this server confirms the session with the Verify & Access API and
 * displays a success page.
 */

const express = require("express");
const path    = require("path");

const app  = express();
const PORT = process.env.PORT || 3004;
const CONSOLE_URL = process.env.CONSOLE_URL || "http://localhost:3001";

// Serve the test harness
app.get("/test", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Protected site callback — simulates what a CF Worker would do
app.get("/", async (req, res) => {
  const vaSession = req.query.va_session;
  const vaStatus  = req.query.va_status;

  if (vaSession && vaStatus === "verified") {
    // A real CF Worker would confirm the session with the API here.
    // We'll just show a success page.
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Protected Site — Access Granted</title>
        <style>
          body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; margin: 0;
            background: linear-gradient(135deg, #064e3b, #065f46);
            color: #ecfdf5;
          }
          .card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 16px; padding: 2.5rem;
            max-width: 500px; text-align: center;
          }
          h1 { font-size: 2rem; margin-bottom: 0.5rem; }
          p { color: #a7f3d0; line-height: 1.6; }
          code { background: rgba(0,0,0,0.3); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
          a { color: #6ee7b7; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✅ Access Granted!</h1>
          <p>Age verification confirmed via Concordium zero-knowledge proof.</p>
          <p>Session: <code>${vaSession}</code></p>
          <p>
            In a real deployment, the CloudFlare Worker would set a cookie
            at this point and serve the protected content.
          </p>
          <p style="margin-top:1.5rem;">
            <a href="/test">← Back to Test Harness</a>
          </p>
        </div>
      </body>
      </html>
    `);
  }

  // Default: show "protected content" page
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Protected Site (Simulated)</title>
      <style>
        body {
          font-family: 'Segoe UI', system-ui, sans-serif;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; margin: 0;
          background: #1e293b; color: #e2e8f0;
        }
        .card {
          background: #334155; border-radius: 16px; padding: 2.5rem;
          max-width: 500px; text-align: center;
        }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        p { color: #94a3b8; line-height: 1.6; }
        a { color: #60a5fa; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>🔒 Protected Site</h1>
        <p>This simulates a site protected by a CloudFlare Worker.</p>
        <p>In production, the Worker would redirect you to verification before showing this page.</p>
        <p style="margin-top:1.5rem;">
          <a href="/test">Go to Test Harness →</a>
        </p>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`\n  🧪 Test Worker Server running:`);
  console.log(`     Test harness:   http://localhost:${PORT}/test`);
  console.log(`     Protected site: http://localhost:${PORT}/`);
  console.log(`     Console URL:    ${CONSOLE_URL}\n`);
});
