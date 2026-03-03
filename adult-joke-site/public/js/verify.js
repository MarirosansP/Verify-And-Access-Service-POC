import { ConcordiumVerificationWebUI } from '@concordium/verification-web-ui';

console.log('[verify] verify.js loaded');

const statusEl = document.getElementById('status');
const btnStart = document.getElementById('btnStart');
const btnReset = document.getElementById('btnReset');

const WC_TOPIC_KEY = 'ccd_wc_topic';

function setStatus(msg) {
  console.log('[verify] status:', msg);
  statusEl.textContent = msg;
}

btnReset.addEventListener('click', async (e) => {
  e.preventDefault();
  // Clear our key plus all SDK-owned localStorage keys
  ['ccd_wc_topic', 'activeSession', 'sdkNetwork', 'sdkProjectId', 'connectionMode'].forEach(k => localStorage.removeItem(k));
  await fetch('/api/reset', { method: 'POST' });
  // Reset SDK instance so it re-initialises cleanly next time
  if (webUi) {
    try { await webUi.disconnect?.(); } catch(_) {}
    webUi = null;
  }
  listenerAttached = false;
  currentVPR = null;
  vprInFlight = false;
  setStatus('Reset. Ready.');
});

let webUi = null;
let listenerAttached = false;
let currentVPR = null;

function getActiveTopic(data) {
  if (data?.topic) { localStorage.setItem(WC_TOPIC_KEY, data.topic); return data.topic; }
  if (data?.session?.topic) { localStorage.setItem(WC_TOPIC_KEY, data.session.topic); return data.session.topic; }
  const stored = localStorage.getItem(WC_TOPIC_KEY);
  if (stored) return stored;
  try {
    const session = webUi?.getCurrentSession?.() || webUi?.currentSession;
    if (session?.topic) { localStorage.setItem(WC_TOPIC_KEY, session.topic); return session.topic; }
  } catch(e) {}
  return null;
}

let vprInFlight = false;

async function sendVPR(topic) {
  if (vprInFlight) { console.log('[verify] VPR already in flight, ignoring duplicate trigger'); return; }
  vprInFlight = true;
  setStatus('Wallet connected. Creating verification request…');

  try {
    const vprRes = await fetch('/api/create-verification-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: topic }),
    });

    if (!vprRes.ok) {
      setStatus('Error creating VPR: ' + (await vprRes.text()));
      vprInFlight = false;
      return;
    }

    currentVPR = await vprRes.json();
    console.log('[verify] VPR created:', currentVPR);
    setStatus('Sending proof request to your wallet…');

    // sendPresentationRequest may EITHER:
    //   a) return a Promise that resolves with the VP (presentation), OR
    //   b) return undefined and emit a 'presentation_received' event
    // Handle both cases. Wrap in a timeout to catch stale/dead sessions.
    const TIMEOUT_MS = 15_000;
    let presentation = null;
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
      );
      const result = await Promise.race([
        webUi.sendPresentationRequest(currentVPR, topic),
        timeout,
      ]);
      console.log('[verify] sendPresentationRequest resolved:', result);
      if (result) {
        presentation = result;
      }
    } catch(err) {
      console.error('[verify] sendPresentationRequest threw:', err);
      if (err.message === 'timeout') {
        // Returning session relay is dead — clear it and show fresh QR
        console.log('[verify] relay timeout, clearing session and falling back to fresh QR');
        setStatus('Session expired — starting fresh connection…');
        ['ccd_wc_topic', 'activeSession', 'sdkNetwork', 'sdkProjectId', 'connectionMode'].forEach(k => localStorage.removeItem(k));
        try { indexedDB.deleteDatabase('WALLET_CONNECT_V2_INDEXED_DB'); } catch(_) {}
        vprInFlight = false;
        currentVPR = null;
        // Re-initialise SDK so a fresh QR is shown
        try { await webUi.disconnect?.(); } catch(_) {}
        webUi = null;
        listenerAttached = false;
        // Small pause then re-trigger as if fresh user
        await new Promise(r => setTimeout(r, 500));
        await initAndConnect();
      } else {
        setStatus('Error sending proof request: ' + err.message);
        vprInFlight = false;
      }
      return;
    }

    if (presentation) {
      await verifyPresentation(presentation);
    } else {
      // Presentation will arrive via concordium-event presentation_received / presentation-received
      setStatus('Waiting for you to approve in the Concordium ID App…');
    }
  } finally {
    // Always reset so the user can retry without refreshing
    vprInFlight = false;
  }
}

async function verifyPresentation(presentation) {
  setStatus('Proof received. Verifying with gateway…');
  console.log('[verify] verifying presentation:', presentation);

  if (!currentVPR) {
    setStatus('Error: no VPR found. Please reset and try again.');
    return;
  }

  // presentation from event is { verifiablePresentationJson: {...} } - unwrap it
  const vp = presentation?.verifiablePresentationJson ?? presentation;
  console.log('[verify] VP keys:', Object.keys(vp || {}));

  const verifyRes = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      presentation: vp,
      verificationRequest: currentVPR,
    }),
  });

  if (!verifyRes.ok) {
    setStatus('Verification failed: ' + (await verifyRes.text()));
    return;
  }

  const out = await verifyRes.json();
  console.log('[verify] verify response:', out);

  if (out.ok) {
    setStatus('Age verified! Redirecting…');
    webUi.showSuccessState?.();
    localStorage.setItem('ccd_verified', '1');
    setTimeout(() => (location.href = '/joke'), 1200);
  } else {
    setStatus('Verification failed. Please try again.');
    webUi.closeModal?.();
  }
}

async function handleConcordiumEvent(event) {
  try {
    const { type, data } = event?.detail || {};
    if (!type) return;
    console.log('[verify] concordium-event:', type, data);

    // session_approved fires after fresh QR scan
    // active_session fires when user clicks 'Start private verification' (returning user)
    if (type === 'session_approved' || type === 'active_session') {
      const topic = getActiveTopic(data);
      console.log('[verify] resolved topic:', topic);
      if (!topic) {
        setStatus('Error: could not resolve WalletConnect session topic. Please disconnect and try again.');
        return;
      }
      // For returning sessions give the WalletConnect relay a moment to
      // fully reconnect before sending the presentation request.
      if (type === 'active_session') {
        console.log('[verify] returning session - waiting 5s for relay to reconnect...');
        await new Promise(r => setTimeout(r, 5000));
      }
      await sendVPR(topic);
      return;
    }

    // VP received via event
    if (type === 'presentation_received') {
      console.log('[verify] presentation received via event:', data);
      await verifyPresentation(data);
      return;
    }

    if (type === 'session_disconnected') {
      localStorage.removeItem(WC_TOPIC_KEY);
      setStatus('Wallet disconnected. Please start again.');
    }

    if (type === 'error') {
      setStatus('SDK error: ' + (data?.message || JSON.stringify(data)));
    }

  } catch (err) {
    console.error('[verify] event handler error:', err);
    setStatus('Error: ' + (err?.message || String(err)));
  }
}

async function initAndConnect() {
  const cfg = window.__VNA__ || {};
  if (!cfg.walletConnectProjectId) {
    setStatus('Missing WALLETCONNECT_PROJECT_ID. Set it in .env / docker-compose.');
    return;
  }

  currentVPR = null;
  setStatus('Initialising WalletConnect…');

  if (!listenerAttached) {
    window.addEventListener('@concordium/verification-web-ui-event', handleConcordiumEvent);
    listenerAttached = true;
  }

  if (!webUi) {
    webUi = new ConcordiumVerificationWebUI({
      projectId: cfg.walletConnectProjectId,
      network: cfg.network || 'mainnet',
      metadata: {
        name: 'Peachy Pints',
        description: 'Age verification',
        url: window.location.origin,
        icons: [],
      },
    });
    await webUi.renderUIModals();
    window.__webUi__ = webUi;
  }
}

btnStart.addEventListener('click', async (e) => {
  e.preventDefault();
  console.log('[verify] Start verification clicked');
  await initAndConnect();
});
