import express from 'express';
import cookieSession from 'cookie-session';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3003);

// Phase-1 gateway (verify-gateway)
const VERIFY_GATEWAY_BASE_URL = (process.env.VERIFY_GATEWAY_BASE_URL || 'http://verify-gateway:3002').replace(/\/$/, '');
const VERIFY_API_KEY = process.env.VERIFY_API_KEY || '';

// What you are verifying
const RESOURCE_ID = process.env.RESOURCE_ID || 'peachy-pints.local';
const CONTEXT_STRING = process.env.CONTEXT_STRING || 'over18';

// Optional: publicInfo key/value (value must be CBOR-hex according to the verifier service docs)
// Keep a working default that matches Phase-1 examples.
const PUBLIC_INFO_KEY = process.env.PUBLIC_INFO_KEY || 'sessionIdRef';
const PUBLIC_INFO_CBOR_HEX = process.env.PUBLIC_INFO_CBOR_HEX || '7673616d706c652d73657373696f6e2d69642d31323334';

// WalletConnect Project Id (not secret; sent to browser)
const WALLETCONNECT_PROJECT_ID = process.env.WALLETCONNECT_PROJECT_ID || '';
const NETWORK = process.env.CCD_NETWORK || 'mainnet';

if (!VERIFY_API_KEY) {
  console.warn('[adult-joke-site] VERIFY_API_KEY is not set. The site cannot call the Phase-1 gateway.');
}

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(
  cookieSession({
    name: 'vna_session',
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // set true if you put it behind HTTPS
    secret: process.env.SESSION_SECRET || 'change-me-in-prod',
    maxAge: 1000 * 60 * 60 * 2, // 2 hours
  })
);

// Static assets
app.use('/static', express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// Serve the verification-web-ui package as static files.
// We don't "import" the package here (it is ESM + has restrictive exports); we only locate its installed files.
(() => {
  try {
    const require = createRequire(import.meta.url);

    // Prefer explicit dist entry.
    let entry;
    try {
      entry = require.resolve('@concordium/verification-web-ui/dist/index.js');
    } catch {
      entry = require.resolve('@concordium/verification-web-ui');
    }

    const distDir = path.resolve(path.dirname(entry)); // .../node_modules/@concordium/verification-web-ui/dist

    // Find a CSS file shipped by the package (location differs across versions).
    let cssPath = null;
    const directCandidates = ['styles.css', 'style.css', 'index.css'].map((f) => path.join(distDir, f));
    for (const p of directCandidates) {
      if (fs.existsSync(p)) {
        cssPath = p;
        break;
      }
    }

    if (!cssPath) {
      // Some builds place CSS one directory up (package root).
      const parent = path.dirname(distDir);
      const parentCandidates = ['styles.css', 'style.css', 'index.css'].map((f) => path.join(parent, f));
      for (const p of parentCandidates) {
        if (fs.existsSync(p)) {
          cssPath = p;
          break;
        }
      }
    }

    if (!cssPath) {
      // Last resort: pick the first *.css in dist.
      const files = fs.readdirSync(distDir).filter((f) => f.toLowerCase().endsWith('.css'));
      if (files.length) cssPath = path.join(distDir, files[0]);
    }

    // Serve the whole dist folder (modules, images, etc.)
    app.use('/vendor/verification-web-ui/dist', express.static(distDir, {
      fallthrough: true,
      setHeaders(res) {
        // ensure module JS isn't blocked by a wrong MIME type
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }));

    // Stable URLs used by our HTML (avoid coupling to package internal filenames)
    app.get('/vendor/verification-web-ui/index.js', (req, res) => {
      // Serve the resolved entry file directly.
      if (!fs.existsSync(entry)) return res.status(404).type('text/plain').send('verification-web-ui index.js not found');
      res.type('application/javascript');
      return res.sendFile(entry);
    });

    app.get('/vendor/verification-web-ui/styles.css', (req, res) => {
      if (!cssPath) return res.status(404).type('text/plain').send('verification-web-ui css not found');
      res.type('text/css');
      return res.sendFile(cssPath);
    });

    console.log('[adult-joke-site] verification-web-ui assets served from', distDir);
  } catch (e) {
    console.error('[adult-joke-site] Could not wire verification-web-ui as static assets:', e?.message || e);
  }
})();

function isVerified(req) {
  return Boolean(req.session?.verified === true);
}

app.get('/', (req, res) => {
  if (isVerified(req)) return res.redirect('/joke');
  return res.redirect('/verify');
});

app.get('/verify', (req, res) => {
  res.type('html').send(renderVerifyPage({
    walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
    network: NETWORK,
    resourceId: RESOURCE_ID,
    contextString: CONTEXT_STRING,
  }));
});

app.get('/joke', (req, res) => {
  if (!isVerified(req)) return res.redirect('/verify');
  res.type('html').send(renderJokePage());
});

app.post('/api/reset', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// Called by the browser to create a verification request.
app.post('/api/create-verification-request', async (req, res) => {
  try {
    const connectionId = req.body?.connectionId || `conn_${randomUUID()}`;

    const payload = {
      connectionId,
      resourceId: RESOURCE_ID,
      contextString: CONTEXT_STRING,
      publicInfo: {
        [PUBLIC_INFO_KEY]: PUBLIC_INFO_CBOR_HEX,
      },
      requestedClaims: [
        {
          type: 'identity',
          source: ['identityCredential', 'accountCredential'],
          issuers: ['did:ccd:mainnet:idp:0', 'did:ccd:mainnet:idp:1', 'did:ccd:mainnet:idp:2'],
          statements: [
            {
              type: 'AttributeInRange',
              attributeTag: 'dob',
              lower: '18000101',
              upper: '20080219',
            },
          ],
        },
      ],
    };

    const r = await fetch(`${VERIFY_GATEWAY_BASE_URL}/v1/verifiable-presentations/create-verification-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': VERIFY_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(500).send(text || `create-verification-request failed (${r.status})`);
    }

    const json = JSON.parse(text);
    // persist connectionId so we can tie verify results to this browser session
    req.session.connectionId = connectionId;
    res.json(json);
  } catch (e) {
    res.status(500).send(e?.message || String(e));
  }
});

// Called by the browser once it has a verifiable presentation to verify.
app.post('/api/verify', async (req, res) => {
  try {
    const body = req.body;

    const verifyPayload = {
      auditRecordId: randomUUID(),
      publicInfo: {},
      presentation: body.presentation,
      verificationRequest: body.verificationRequest,
    };

    const r = await fetch(`${VERIFY_GATEWAY_BASE_URL}/v1/verifiable-presentations/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': VERIFY_API_KEY,
      },
      body: JSON.stringify(verifyPayload),
    });

    const text = await r.text();
    if (!r.ok) {
      return res.status(500).send(text || `verify failed (${r.status})`);
    }
    const json = JSON.parse(text);

    // The Phase-1 gateway returns a structured result; we accept common shapes.
    const ok = Boolean(
      json?.verified === true ||
        json?.isValid === true ||
        json?.result === 'verified' ||
        json?.result === true ||
        json?.outcome === true ||
        json?.decision === true
    );
    if (ok) {
      req.session.verified = true;
    }

    res.json({ ok, raw: json });
  } catch (e) {
    res.status(500).send(e?.message || String(e));
  }
});

app.get('/api/joke', (req, res) => {
  if (!isVerified(req)) return res.status(401).json({ error: 'not_verified' });
  res.json({ joke: randomAdultJoke() });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[adult-joke-site] listening on :${PORT}`);
  console.log(`[adult-joke-site] gateway: ${VERIFY_GATEWAY_BASE_URL}`);
});

function renderVerifyPage({ walletConnectProjectId, network, resourceId, contextString }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Adults Only</title>
    <link rel="stylesheet" href="/static/build/verify.css" />
    <link rel="stylesheet" href="/static/css/site.css" />
</head>
  <body>
    <main class="container">
      <h1>🔞 Adults only</h1>
      <p class="sub">Before you can enter, prove you’re over 18 using Concordium Verify &amp; Access.</p>

      <div class="card">
        <div id="qr"></div>
        <div class="actions">
          <button id="btnStart">Start verification</button>
          <button id="btnReset" class="secondary">Reset</button>
        </div>
        <pre id="status" class="status">Ready.</pre>
      </div>
    </main>

    <script>
      window.__VNA__ = ${JSON.stringify({ walletConnectProjectId, network, resourceId, contextString })};
    </script>
    <script src="/static/build/verify.js"></script>
  </body>
</html>`;
}

function renderJokePage() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Adult Joke</title>
    <link rel="stylesheet" href="/static/css/site.css" />
  </head>
  <body>
    <main class="container">
      <h1>✅ Verified</h1>
      <p class="sub">Here’s your randomly generated (adult-ish) joke. Refresh for a new one.</p>

      <div class="card">
        <p id="joke" class="joke">Loading…</p>
        <div class="actions">
          <button id="btnAnother">Another one</button>
          <a class="secondary" href="/verify" id="btnReverify">Re-verify</a>
        </div>
      </div>
    </main>

    <script type="module">
      async function load() {
        const r = await fetch('/api/joke');
        if (!r.ok) {
          location.href = '/verify';
          return;
        }
        const { joke } = await r.json();
        document.getElementById('joke').textContent = joke;
      }
      document.getElementById('btnAnother').addEventListener('click', (e) => {
        e.preventDefault();
        load();
      });
      load();
    </script>
  </body>
</html>`;
}

function randomAdultJoke() {
  // Keep it "adult" but not explicit/graphic.
  const jokes = [
    "I told my partner I needed more space… so they bought a bigger bed. Now we’re further apart *and* still arguing.",
    "My love life is like my Wi‑Fi: it looks strong in the living room, then drops as soon as I get to the bedroom.",
    "I tried roleplay once. I said, ‘You be the responsible adult.’ They replied, ‘Hard pass.’",
    "I’m not saying I’m high‑maintenance… but my therapist has a loyalty card.",
    "I bought ‘grown‑up’ candles to set the mood. Now the room smells like ‘Debt’ and ‘Monday’.",
    "I asked for a quickie… the internet speed test was faster.",
    "My dating profile says ‘emotionally available’. That’s a lie. I’m currently out of stock.",
    "I flirt like I do software updates: I promise it’ll be quick, then I need a restart and everybody loses patience.",
    "I’m at the age where ‘Netflix and chill’ means ‘fall asleep during episode two’.",
    "I tried being kinky. Turns out my greatest turn‑on is eight hours of uninterrupted sleep.",
  ];
  return jokes[Math.floor(Math.random() * jokes.length)];
}
