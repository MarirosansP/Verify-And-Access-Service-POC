# Verify & Access – Phase 1 (Mainnet) – Verifier SaaS UI + Gateway

This repository contains **Phase 1 only**:

* `console-web/` : Next.js SaaS UI (signup/login/dashboard, API keys, usage)
* `verify-gateway/` : API-key enforcement + proxy to Concordium credential-verification-service
* `docker-compose.yml` : runs console + gateway + verifier service
* `keys/` : place your exported Concordium account key file here.

## 1) Prerequisites

* Docker Desktop (or Docker Engine + Compose)
* A Concordium **Mainnet** account key export file for the verifier:
  + `keys/verifier_account.export` (mounted read-only into the verifier container)
* The verifier account must have enough CCD to pay fees for anchoring.

## 2) Configure secrets

Copy the sample environment file and fill in your values:

```bash
cp .env.sample .env
```

Edit `.env` and set:

* `NEXTAUTH_SECRET` – a long random string (generate with `openssl rand -base64 32`)
* `USAGE_SHARED_SECRET` – a long random string (same value is shared between console-web and verify-gateway)
* `CONCORDIUM_NODE_URL` – your Concordium node gRPC endpoint

## 3) Add your verifier signing key

Put your exported key file here:

```
keys/verifier_account.export
```

> ⚠️ Do **not** commit this file to Git. The `.gitignore` is configured to exclude it.

## 4) Start the stack

From this folder:

```bash
docker compose up
```

| Service      | URL                     |
|-------------|-------------------------|
| SaaS UI     | http://localhost:3001    |
| Gateway API | http://localhost:3002    |
| Verifier API (proxied by gateway) | http://localhost:8000 |

## 5) Create an API key in the UI

1. Sign up
2. Login
3. Dashboard → Create API key (copy once)
4. Pause / revoke keys as needed

## 6) Test gateway auth

```bash
curl -X POST http://localhost:3002/v1/verifiable-presentations/create-verification-request \
  -H "X-API-Key: <your_key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Notes

* If your node requires TLS, set `CONCORDIUM_NODE_URL` to an `https://` address in your `.env`.

## Key export guidance

The verifier service expects an exported key file mounted into the container.
See the Concordium documentation for how to create an account export file.
