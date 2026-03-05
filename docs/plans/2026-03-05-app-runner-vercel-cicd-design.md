# App Runner + Vercel + GitHub Actions CI/CD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up GitHub Actions CI/CD for backend deployment to AWS App Runner, and configure Vercel for frontend auto-deploys.

**Architecture:** GitHub Actions workflow triggers on pushes to `main` that change `backend/` files — builds Docker image, pushes to ECR, triggers App Runner redeployment. Frontend deploys automatically via Vercel on any push to `main`. Vercel config is minimal since it auto-detects Next.js.

**Tech Stack:** GitHub Actions, AWS ECR, AWS App Runner, Vercel, Docker

---

### Task 1: Create GitHub Actions workflow for backend CI/CD

**Files:**
- Create: `.github/workflows/deploy-backend.yml`

**Step 1: Create the workflow file**

```yaml
name: Deploy Backend to AWS App Runner

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-backend.yml'

env:
  AWS_REGION: ${{ secrets.AWS_REGION || 'us-east-1' }}
  ECR_REPOSITORY: pr-summarizer-backend

jobs:
  deploy:
    name: Build and Deploy
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push Docker image to ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd backend
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Deploy to App Runner
        run: |
          aws apprunner start-deployment \
            --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN }}
```

**Step 2: Verify the YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-backend.yml'))"`
Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add .github/workflows/deploy-backend.yml
git commit -m "ci: add GitHub Actions workflow for backend deployment to App Runner"
```

---

### Task 2: Create Vercel configuration for frontend

**Files:**
- Create: `frontend/vercel.json`

**Step 1: Create the Vercel config**

```json
{
  "framework": "nextjs",
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
```

This is minimal — Vercel auto-detects most of this, but having it explicit prevents misconfiguration. The root directory (`frontend/`) is set in the Vercel dashboard, not in this file.

**Step 2: Commit**

```bash
git add frontend/vercel.json
git commit -m "chore: add Vercel configuration for frontend deployment"
```

---

### Task 3: Update README with new deployment instructions

**Files:**
- Modify: `README.md` (replace the AWS Deployment section)

**Step 1: Update the deployment section in README.md**

Replace the "## AWS Deployment" section and everything after it (lines ~140-193) with:

```markdown
## Deployment

### Backend (AWS App Runner)

Automated via GitHub Actions on push to `main` (when `backend/` files change).

**Initial setup (one-time):**
1. Run `./scripts/deploy-backend.sh --create-app-runner` to create ECR repo and App Runner service
2. In App Runner console, set environment variables: `ANTHROPIC_API_KEY`, `ALLOWED_ORIGINS`
3. Note the App Runner service URL and ARN

**Required GitHub repo secrets:**
| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_REGION` | AWS region (default: us-east-1) |
| `APP_RUNNER_SERVICE_ARN` | ARN from App Runner console |

After setup, every push to `main` that changes `backend/` files auto-deploys.

### Frontend (Vercel)

1. Import the repo in [Vercel](https://vercel.com/new)
2. Set root directory to `frontend`
3. Add environment variable: `NEXT_PUBLIC_API_URL` = your App Runner URL
4. Deploy — Vercel auto-deploys on every push to `main`

### Manual Backend Deployment

```bash
./scripts/deploy-backend.sh              # push to ECR only
./scripts/deploy-backend.sh --create-app-runner  # also create App Runner service
```

For detailed AWS setup instructions, see [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md).
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update deployment instructions for App Runner + Vercel"
```

---

### Task 4: Update CLAUDE.md with deployment info

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add deployment section to CLAUDE.md**

Append after the "Key Conventions" section:

```markdown

## Deployment

- **Backend**: AWS App Runner, auto-deployed via GitHub Actions (`.github/workflows/deploy-backend.yml`) on push to `main` when `backend/` files change. Manual deploy: `./scripts/deploy-backend.sh`
- **Frontend**: Vercel, auto-deploys on push to `main`. Root directory set to `frontend/` in Vercel dashboard
- **Required GitHub secrets**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `APP_RUNNER_SERVICE_ARN`
- Detailed AWS setup guide: `docs/AWS_DEPLOYMENT.md`
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add deployment info to CLAUDE.md"
```

---

## Setup Checklist (Manual — not automated)

After the code changes are committed and pushed, the user needs to:

1. **AWS (if not already done):**
   - Run `./scripts/deploy-backend.sh --create-app-runner`
   - Set `ANTHROPIC_API_KEY` and `ALLOWED_ORIGINS` in App Runner console
   - Note the App Runner URL and service ARN

2. **GitHub repo secrets:**
   - Go to repo Settings > Secrets and variables > Actions
   - Add: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `APP_RUNNER_SERVICE_ARN`

3. **Vercel:**
   - Go to vercel.com/new, import the repo
   - Set root directory to `frontend`
   - Set env var `NEXT_PUBLIC_API_URL` to the App Runner URL
   - Deploy

4. **Update CORS:**
   - In App Runner, update `ALLOWED_ORIGINS` to include the Vercel URL
