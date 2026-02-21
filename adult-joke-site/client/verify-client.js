import { ConcordiumVerificationWebUI } from '@concordium/verification-web-ui';
import '@concordium/verification-web-ui/styles';

// This bundle runs on /verify page. It wires up the "Start verification" button,
// renders QR + WalletConnect options, and polls the backend for completion.

const $ = (id) => document.getElementById(id);
const statusEl = () => $('status');

async function getConfig() {
  const r = await fetch('/api/config', { credentials: 'include' });
  if (!r.ok) throw new Error(`Failed to load config (${r.status})`);
  return r.json();
}

async function startVerification() {
  const r = await fetch('/api/start', { method: 'POST', credentials: 'include' });
  const txt = await r.text();
  if (!r.ok) throw new Error(txt || `Start failed (${r.status})`);
  return JSON.parse(txt);
}

async function poll() {
  const r = await fetch('/api/poll', { credentials: 'include' });
  if (!r.ok) return { status: 'error' };
  return r.json();
}

async function run() {
  const btn = $('startBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    statusEl().textContent = 'Starting verification...';

    try {
      const cfg = await getConfig();
      const { request } = await startVerification();

      // Mount SDK
      const mountEl = $('sdkMount');
      mountEl.innerHTML = '';

      // SDK options per guide:
      const sdk = new ConcordiumVerificationWebUI({
        network: cfg.network,
        projectId: cfg.walletconnectProjectId,
        metadata: cfg.walletconnectMetadata,
      });

      // Render UI
      sdk.mount(mountEl, {
        request,
        // Optional callback to show current state
        onStateChange: (state) => {
          statusEl().textContent = `Verification state: ${state}`;
        },
      });

      statusEl().textContent = 'Scan the QR code (or use WalletConnect) to verify...';

      // Poll backend for completion
      const startedAt = Date.now();
      const timeoutMs = (cfg.ttlSeconds || 300) * 1000;

      const tick = async () => {
        const p = await poll();
        if (p.status === 'verified') {
          window.location.href = '/';
          return;
        }
        if (p.status === 'failed') {
          statusEl().textContent = 'Verification failed. Please try again.';
          btn.disabled = false;
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          statusEl().textContent = 'Timed out. Please try again.';
          btn.disabled = false;
          return;
        }
        setTimeout(tick, 1500);
      };
      tick();
    } catch (e) {
      statusEl().textContent = `Error: ${e?.message || e}`;
      btn.disabled = false;
    }
  });
}

// expose for debugging
window.VerifyClient = { run };
run();
