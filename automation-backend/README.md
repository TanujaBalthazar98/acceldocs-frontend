# Docs Automation Backend (Phase 3 Skeleton)

This is a new backend service created separately from Strapi.

## Included in this phase
- Metadata DB schema (`src/db/schema.sql`)
- Ingestion module skeleton (`src/modules/ingestion`)
- Markdown conversion module skeleton (`src/modules/markdown`)
- Publish queue module (`src/modules/publish-queue`)
- Logging system (`src/logging/logger.ts`)
- API skeleton (`src/api/routes.ts`)

## Not included yet
- No approval UI in this phase
- No full Google Drive auth/connector implementation yet
- No full HTML->Markdown fidelity implementation yet
- No production Git publish implementation yet

## Run
1. `cd automation-backend`
2. `npm install`
3. `cp .env.example .env`
4. `npm run db:init`
5. `npm run dev`

API quick checks:
- `GET /health`
- `POST /sync/run`
- `POST /convert/html-to-markdown`
- `POST /publish/queue`
