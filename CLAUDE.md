# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Concordium Verify & Access SaaS platform (Phase 1, Mainnet). Provides blockchain-based age verification using Concordium identity credentials and zero-knowledge proofs.

Four services orchestrated via Docker Compose:
- **console-web** (port 3001): Next.js 14 SaaS UI — user signup/login, API key management, worker key management, usage dashboard, verification pages
- **verify-gateway** (port 3002): Express API gateway — API key enforcement, usage tracking, proxying to Concordium credential-verification-service
- **adult-joke-site** (port 3003): Demo 18+ gated site showing integration
- **test-worker** (port 3004): Test harness for verification flows

## Build & Run Commands

```bash
# Start full stack (all services)
docker compose up

# Rebuild after Dockerfile changes
docker compose up --build

# console-web development (inside container or locally)
cd console-web
npm run dev              # Next.js dev server (port 3001)
npm run build            # Production build
npm run build-sdk        # Bundle Concordium verification SDK via esbuild
npm run prisma:generate  # Regenerate Prisma client after schema changes
npm run db:push          # Push schema changes to SQLite
npm run db:studio        # Open Prisma Studio (GUI DB browser)
```

## Architecture

```
Browser/Worker → verify-gateway (Express, port 3002)
                    ├── validates API keys via console-web /api/internal/introspect
                    ├── tracks usage via console-web /api/internal/usage
                    └── proxies verification requests → credential-verifier (port 8000)

Browser → console-web (Next.js App Router, port 3001)
              ├── /signup, /login — NextAuth v4 (JWT + email/password, bcrypt 12 rounds)
              ├── /dashboard — API key & worker key CRUD, usage analytics
              ├── /verify/:sessionId — public verification page (WalletConnect QR)
              └── /api/worker/* — worker key initiation, session polling, VP submission
```

### Worker Key Verification Flow

1. External worker calls `POST /api/worker/initiate` with `X-Worker-Key` header
2. Console creates session (stored in `/data/worker-sessions.json`, 5-min TTL, auto-purged)
3. VPR (Verifiable Presentation Request) pre-created at initiation to avoid race conditions
4. User redirected to `/verify/:sessionId` → scans QR → WalletConnect → wallet generates ZK proof
5. Browser posts VP to `/api/worker/submit-vp/:sessionId`
6. Worker polls `/api/worker/status/:sessionId` until verified

### Key Formats

- API keys: `va_live_<60 hex chars>` — prefix stored for lookup, hash (bcrypt 12) stored for validation
- Worker keys: `wk_<64 hex chars>` — SHA256 hash stored

## Tech Stack

- **console-web**: Next.js 14.2.7, React 18, TypeScript (strict: false), Prisma + SQLite, NextAuth 4, Zod, esbuild
- **verify-gateway**: Express 4, Helmet, http-proxy-middleware (plain JS, no TypeScript)
- **Database**: SQLite at `/app/data/console.db` (Docker volume `console_data`)
- **Blockchain**: Concordium mainnet, `concordium/credential-verification-service:0.1.0` Docker image
- **SDK**: `@concordium/verification-web-ui` bundled via esbuild for browser use

## Key File Paths

- `console-web/src/lib/` — shared utilities (db.ts, auth options, key helpers, session management)
- `console-web/src/app/api/` — all API route handlers (Next.js App Router)
- `console-web/prisma/schema.prisma` — database schema (User, ApiKey, WorkerKey, UsageEvent)
- `verify-gateway/src/index.js` — single-file Express gateway
- `docker-compose.yml` — full stack orchestration
- `.env.sample` — required environment variables template

## Database Schema (Prisma + SQLite)

Models: `User`, `ApiKey`, `WorkerKey`, `UsageEvent`. Relations: User has many ApiKeys, WorkerKeys, and UsageEvents. ApiKey has many UsageEvents. Schema sync uses `prisma db push` (no migration files).

## Environment Setup

```bash
cp .env.sample .env
# Required: NEXTAUTH_SECRET, USAGE_SHARED_SECRET (openssl rand -base64 32)
# Required: CONCORDIUM_NODE_URL (gRPC endpoint)
# Required: keys/verifier_account.export (Concordium account key file, never committed)
```

Internal service communication uses `USAGE_SHARED_SECRET` (gateway ↔ console) and `SYSTEM_API_KEY` (console → gateway).

## Conventions

- Path alias: `@/*` maps to `src/*` in console-web
- API responses use `{ error: "error_code" }` format with standard HTTP status codes
- Worker sessions stored in JSON file (not database) with 5-minute TTL
- console-web source volume-mounted in Docker for live reload during development
- verify-gateway runs `npm install` on container start (no pre-built image)
