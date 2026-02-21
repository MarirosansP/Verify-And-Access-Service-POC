# Adult Joke Site (Phase 2 demo)

A tiny **18+ gated** website that uses Concordium **Verify & Access**.

- Frontend uses **@concordium/verification-web-ui** to render the WalletConnect UI (QR code/deep link) and handle session/presentation events.
- Backend is just **Next.js API routes**, used to call the already-running **Phase 1 verify-gateway** so your API key never reaches the browser.

## What you already have (Phase 1)
You already run:
- `verify-gateway` on port `3002`
- `credential-verifier` on port `8000`

This site talks to `verify-gateway` over the Docker network.

## Environment variables
Set these on the **adult-joke-site** container:

### Required
- `VERIFY_ACCESS_API_KEY` – the API key created in Phase 1 (server-side only)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` – WalletConnect project id (client-side)

### Recommended
- `VERIFY_GATEWAY_BASE_URL` – defaults to `http://verify-gateway:3002`
- `VERIFY_RESOURCE_ID` – defaults to `peachy-pints.local`
- `VERIFY_CONTEXT_STRING` – defaults to `over18`
- `VERIFY_CONNECTION_ID` – defaults to `conn_test_001`
- `NEXT_PUBLIC_CCD_NETWORK` – `mainnet` (default) or `testnet`

## Run locally (outside Docker)
```bash
npm install
export VERIFY_ACCESS_API_KEY='...'
export NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID='...'
export VERIFY_GATEWAY_BASE_URL='http://localhost:3002'
npm run dev
```
Open `http://localhost:3003`.

## Run with your Phase 1 docker-compose
Add a service like this to your existing compose (same network as verify-gateway):

```yaml
  adult-joke-site:
    build: ./adult-joke-site
    ports:
      - "3003:3003"
    environment:
      VERIFY_GATEWAY_BASE_URL: http://verify-gateway:3002
      VERIFY_ACCESS_API_KEY: ${VERIFY_ACCESS_API_KEY}
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: ${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}
      NEXT_PUBLIC_CCD_NETWORK: mainnet
      VERIFY_RESOURCE_ID: peachy-pints.local
      VERIFY_CONTEXT_STRING: over18
      VERIFY_CONNECTION_ID: conn_test_001
    depends_on:
      - verify-gateway
```

## Notes
- `publicInfo` values are **CBOR-encoded hex strings**.
- The server encodes a session reference (WalletConnect topic) using CBOR and forwards that to Phase 1.
