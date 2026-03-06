# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

PR & Issue Summarizer — a web app that fetches GitHub PRs/Issues and uses Claude AI to generate summaries, risk tags, and test checklists. Two-tier architecture: Next.js frontend + FastAPI backend.

## Development Commands

### Backend (Python/FastAPI)
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload          # runs on :8000
```
Requires `backend/.env` with `AWS_REGION` (defaults to `us-east-1`).

### Frontend (Next.js/TypeScript)
```bash
cd frontend
npm install
npm run dev                             # runs on :3000
npm run build                           # production build
npm run lint                            # ESLint
```
Requires `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000`.

### Docker
```bash
docker-compose up --build               # backend only, on :8000
```

## Architecture

### Backend (`backend/app/`)
- **`main.py`** — FastAPI app setup, CORS middleware, global error handler
- **`config.py`** — `pydantic-settings` config loaded from `.env` (cached via `@lru_cache`)
- **`routers/github.py`** — All API endpoints under `/api/v1/repos/{owner}/{repo}/`. PR list endpoints summarize up to 5 items with a 1-second delay between Claude API calls to avoid rate limiting
- **`routers/health.py`** — `GET /health`
- **`services/github_service.py`** — GitHub REST API client using `httpx.AsyncClient`. Fetches PRs, issues, diffs, and comments
- **`services/openai_service.py`** — **Despite the filename**, this uses Claude via Amazon Bedrock (`anthropic.AnthropicBedrock`). Named `OpenAIService` but wraps `anthropic.AnthropicBedrock`. Contains `extract_json()` helper for parsing Claude responses from text/markdown. Builds structured prompts and returns `PRSummary`/`IssueSummary` Pydantic models
- **`models/schemas.py`** — All Pydantic models: request/response types, `RiskTag` and `Priority` enums

### Frontend (`frontend/src/`)
- **`app/page.tsx`** — Main page component with tab switching (PRs/Issues), state management, lazy loading per tab
- **`lib/api.ts`** — Axios client (120s timeout) calling backend. All endpoints use POST with `github_token` in body
- **`components/`** — `TokenInput`, `RepoSelector`, `PRList`, `IssueList`, `SummaryCard`, `LoadingSpinner`
- **`types/index.ts`** — TypeScript interfaces mirroring backend Pydantic schemas

### Data Flow
1. User enters GitHub token (stored in browser localStorage) and selects a repo
2. Frontend POSTs to backend with token in request body
3. Backend fetches from GitHub API, sends each PR/issue to Claude for summarization
4. Claude returns JSON with summary, risk tags/priority, and test checklist/action items
5. Backend validates and returns structured response to frontend

## Key Conventions

- GitHub tokens are never stored server-side — passed per-request in POST body
- The Anthropic client in `openai_service.py` uses synchronous `client.messages.create()` inside `async` methods (not truly async)
- PR diffs are truncated to 50KB at fetch time and 20KB when sent to Claude
- All API routes are POST (even list endpoints) because they require the token in the body

## Deployment

- **Backend**: AWS App Runner, auto-deployed via GitHub Actions (`.github/workflows/deploy-backend.yml`) on push to `main` when `backend/` files change. Manual deploy: `./scripts/deploy-backend.sh`
- **Frontend**: Vercel, auto-deploys on push to `main`. Root directory set to `frontend/` in Vercel dashboard
- **Required GitHub secrets**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `APP_RUNNER_SERVICE_ARN`
- Detailed AWS setup guide: `docs/AWS_DEPLOYMENT.md`

## Debugging Deployments

- **Always check logs when a deployment fails.** Use `gh run view <run-id> --log-failed` for GitHub Actions failures. For App Runner failures, check CloudWatch logs and `aws apprunner describe-service` for status.
- App Runner deployments fail if the service is in `OPERATION_IN_PROGRESS` state — wait for it to reach `RUNNING` before triggering another deployment.
