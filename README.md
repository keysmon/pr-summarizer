# PR & Issue Summarizer Dashboard

A web application that fetches GitHub PRs/Issues and uses Claude AI to generate summaries, risk tags, and test checklists.

![PR & Issue Summarizer UI](PR_page.png)

## Tech Stack

- **Frontend**: Next.js 14 (TypeScript) with Tailwind CSS
- **Backend**: FastAPI (Python)
- **APIs**: GitHub REST API, Anthropic Claude API
- **Auth**: GitHub Personal Access Token (user-provided)
- **Deployment**: AWS Amplify (frontend) + AWS App Runner (backend)

## Project Structure

```
pr-summarizer/
├── frontend/                    # Next.js application
│   ├── src/
│   │   ├── app/                 # App router pages
│   │   ├── components/          # React components
│   │   ├── lib/                 # API client
│   │   └── types/               # TypeScript types
│   ├── amplify.yml              # AWS Amplify build config
│   └── package.json
│
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Environment config
│   │   ├── routers/             # API endpoints
│   │   ├── services/            # Business logic
│   │   └── models/              # Pydantic schemas
│   ├── requirements.txt
│   └── Dockerfile
│
├── scripts/                     # Deployment scripts
│   └── deploy-backend.sh        # ECR/App Runner deployment
│
├── docs/                        # Documentation
│   └── AWS_DEPLOYMENT.md        # Detailed AWS deployment guide
│
└── docker-compose.yml           # Local development
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- Anthropic API key (for Claude AI)
- GitHub Personal Access Token (for users)

## Local Development

### Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run development server
uvicorn app.main:app --reload
```

The backend will be available at `http://localhost:8000`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
cp .env.local.example .env.local

# Run development server
npm run dev
```

The frontend will be available at `http://localhost:3000`.

### Using Docker

```bash
# Run backend with Docker Compose
docker-compose up --build
```

## API Endpoints

### Health Check
```
GET /health
```

### Pull Requests
```
POST /api/v1/repos/{owner}/{repo}/pulls
POST /api/v1/repos/{owner}/{repo}/pulls/{pr_number}
```

### Issues
```
POST /api/v1/repos/{owner}/{repo}/issues
POST /api/v1/repos/{owner}/{repo}/issues/{issue_number}
```

All endpoints accept a JSON body with `github_token` field.

## API Usage Examples

```bash
# Health check
curl http://localhost:8000/health

# Fetch PRs with summaries
curl -X POST http://localhost:8000/api/v1/repos/facebook/react/pulls \
  -H "Content-Type: application/json" \
  -d '{"github_token": "ghp_your_token_here"}'

# Single PR summary
curl -X POST http://localhost:8000/api/v1/repos/facebook/react/pulls/123 \
  -H "Content-Type: application/json" \
  -d '{"github_token": "ghp_your_token_here"}'
```

## AWS Deployment

For detailed deployment instructions, see [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md).

### Quick Start

```bash
# Deploy backend to ECR (then create App Runner service)
./scripts/deploy-backend.sh
```

### Backend (AWS App Runner)

1. Run the deployment script or manually push Docker image to ECR
2. Create an App Runner service with:
   - Port: 8000
   - Health check path: `/health`
   - Environment variables: `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`, `LOG_LEVEL`

### Frontend (AWS Amplify)

1. Connect your GitHub repository to Amplify
2. Set root directory to `pr-summarizer/frontend`
3. Add environment variable: `NEXT_PUBLIC_API_URL` = Your App Runner URL

## Environment Variables

### Backend (.env)
```
ANTHROPIC_API_KEY=sk-ant-your-api-key
ALLOWED_ORIGINS=http://localhost:3000,https://your-amplify-domain.amplifyapp.com
LOG_LEVEL=INFO
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Features

- **PR Summaries**: Concise summaries of pull request changes
- **Risk Tags**: Automatic detection of breaking changes, security issues, performance impacts, etc.
- **Test Checklists**: AI-generated test suggestions for each PR
- **Issue Analysis**: Priority assessment and action items for issues
- **Copy to Clipboard**: Easy sharing of summaries
- **Recent Repos**: Quick access to previously viewed repositories

## Security Notes

- GitHub tokens are stored in browser localStorage (can be cleared via UI)
- Tokens are only sent to the backend for API calls, not stored server-side
- Backend requires CORS configuration for production domains
