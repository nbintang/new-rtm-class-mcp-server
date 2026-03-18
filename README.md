# RTM Class MCP Server

NestJS 11 + Fastify + Prisma PostgreSQL server that exposes MCP tools for saving AI output records.

## What This Project Does

This service receives MCP tool calls and writes generated AI content into:

- `AIOutput`
- `AIJob` (status update after write)

Current implementation focuses on saving output for existing jobs and marking them as completed.

## Current MCP Tools

Implemented in [`src/db/db.resolver.ts`](./src/db/db.resolver.ts):

- `save_mcq_output`
- `save_essay_output`
- `save_summary_output`
- `save_ai_output` (deprecated compatibility shim)

The shim `save_ai_output` supports only:

- `MCQ`
- `ESSAY`
- `SUMMARY`

It does not support `LKPD`, `REMEDIAL`, or `DISCUSSION_TOPIC`.

## Tool Input Contracts

All typed tools require:

- `jobId` (UUID)
- `materialId` (UUID)
- `content` (strict Zod schema)

### `save_mcq_output`

`content` shape:

- `type: "MCQ"`
- `generatedAt: ISO datetime string`
- `questions: [{ id, text, options[4], answer(A|B|C|D), points? }]`

### `save_essay_output`

`content` shape:

- `type: "ESSAY"`
- `generatedAt: ISO datetime string`
- `questions: [{ id, text, rubric, points? }]`

### `save_summary_output`

`content` shape:

- `type: "SUMMARY"`
- `generatedAt: ISO datetime string`
- `summary: string`

Schema source: [`src/db/db.schema.ts`](./src/db/db.schema.ts)

## Write Behavior (Important)

Current behavior in `saveTypedOutput`:

1. `aiOutput.create(...)` is executed.
2. If create succeeds, `aiJob.update(...)` sets:
   - `status = succeeded`
   - `completedAt = now`
   - `lastError = null`
3. If any error occurs:
   - logs error
   - tries `aiJob.update(...)` with:
     - `status = failed_processing`
     - `lastError = <error message>`
     - `completedAt = now`
   - returns `{ success: false, message: ... }`

Notes:

- This implementation does **not** auto-create `AIJob`.
- This implementation does **not** resolve jobs by `externalJobId`.
- `AIOutput.jobId` is unique in Prisma schema, so duplicate writes for same job will fail unless handled upstream.

## Tech Stack

- Node.js
- NestJS 11
- Fastify (`@nestjs/platform-fastify`)
- `@nestjs-mcp/server`
- PostgreSQL + Prisma
- Zod
- Jest

## Prerequisites

- Node.js 20+ (recommended)
- PostgreSQL
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env file:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Generate Prisma client:

```bash
npx prisma generate
```

4. Push schema (for local/dev DB without migrations folder):

```bash
npx prisma db push
```

5. Run dev server:

```bash
npm run start:dev
```

## Environment Variables (Code-Accurate)

### Runtime variables used by app code

| Variable | Required | Used by | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma datasource | PostgreSQL connection string (required by Prisma schema). |
| `PORT` | No | `src/main.ts` | App listen port. Default: `3000` if unset. |

### Variables present in repo but not directly read by app code

| Variable | Where used | Description |
| --- | --- | --- |
| `HOST_PORT` | `docker-compose.yml` | Host port mapping to container `PORT` (default `5003:5002`). |
| `NODE_ENV` | `docker-compose.yml`/Docker runtime | Container runtime mode (`production`/`development`). |
| `APP_HTTP_PROXY` / `APP_HTTPS_PROXY` | `docker-compose.yml` | Optional proxy env injection into container. |
| `NODE_OPTIONS` | `docker-compose.yml` | Optional Node runtime flags in container. |

`.env.example` currently contains:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/rtm_db_dev?schema=public"
PORT=5002
HOST_PORT=5003
```

## Available Scripts

From [`package.json`](./package.json):

```bash
npm run build
npm run start
npm run start:dev
npm run start:debug
npm run start:prod
npm run lint
npm run format
npm run test
npm run test:watch
npm run test:cov
npm run test:debug
npm run test:e2e
```

## HTTP Routes and MCP Transports

### Basic HTTP route

- `GET /` returns `Hello World!`

### MCP transports

Configured in [`src/app.module.ts`](./src/app.module.ts):

- `streamable` enabled
- `sse` enabled

The exact MCP route paths are provided by `@nestjs-mcp/server` defaults unless overridden.

## Database Schema Notes

Prisma schema file: [`prisma/schema.prisma`](./prisma/schema.prisma)

Relevant models:

- `AiJob` mapped to table `"AIJob"`
- `AiOutput` mapped to table `"AIOutput"`

Key constraint:

- `AiOutput.jobId` is `@unique` (one output row per job)

## Docker

`docker-compose.yml` defines profiles:

- `mcp-server` (`prod`)
- `mcp-server-migrate` (`prod`, runs `prisma migrate deploy`)
- `mcp-server-dev` (`dev`, runs watch mode)

Main image is built from [`Dockerfile`](./Dockerfile).
