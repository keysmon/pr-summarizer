# AWS Deployment Guide - PR & Issue Summarizer

This guide walks you through deploying the PR & Issue Summarizer to AWS and Vercel:
- **Backend**: AWS App Runner (containerized FastAPI) with Amazon Bedrock for Claude AI
- **Frontend**: Vercel (Next.js static)
- **CI/CD**: GitHub Actions (backend), Vercel auto-deploy (frontend)

## Prerequisites

1. **AWS Account** with permissions for:
   - ECR (Elastic Container Registry)
   - App Runner
   - Bedrock (Claude model access)
   - IAM (for creating roles)

2. **AWS CLI** installed and configured:
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region (us-east-1)
   ```

3. **Docker** installed and running locally

4. **GitHub repository** with your code

5. **Vercel account** linked to your GitHub

6. **Bedrock model access**: In the AWS Console, go to Bedrock → Model access → Request access to Claude models. You may need to submit a use case form (~15 min to process).

---

## Phase 1: Backend Deployment (AWS App Runner)

### Option A: Using the Deployment Script (Recommended)

```bash
chmod +x scripts/deploy-backend.sh

# Create ECR repo and App Runner service
./scripts/deploy-backend.sh --create-app-runner

# Or push to ECR only (if service already exists)
./scripts/deploy-backend.sh
```

**Script Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `--region` | AWS region | us-east-1 |
| `--repo-name` | ECR repository name | pr-summarizer-backend |
| `--tag` | Docker image tag | latest |
| `--create-app-runner` | Also create App Runner service | false |

### Option B: Manual Steps

#### 1.1 Create ECR Repository

```bash
aws ecr create-repository \
    --repository-name pr-summarizer-backend \
    --region us-east-1 \
    --image-scanning-configuration scanOnPush=true
```

#### 1.2 Build and Push Docker Image

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Build the image (must be amd64 for App Runner)
cd backend
docker build --platform linux/amd64 -t pr-summarizer-backend .

# Tag and push
docker tag pr-summarizer-backend:latest \
    ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/pr-summarizer-backend:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/pr-summarizer-backend:latest
```

> **Important**: App Runner only supports `linux/amd64` images. If you're building on an ARM Mac, always use `--platform linux/amd64`.

#### 1.3 Create App Runner Service

**Via AWS Console:**

1. Navigate to **App Runner** → **Create Service**
2. **Source**: Container registry → Amazon ECR → Select your image
3. **Service settings:**
   - Service name: `pr-summarizer-api`
   - CPU: 1 vCPU, Memory: 2 GB
   - Port: 8000
4. **Health check**: HTTP, Path: `/health`
5. **Environment Variables:**

   | Variable | Value |
   |----------|-------|
   | `ALLOWED_ORIGINS` | `https://your-vercel-domain.vercel.app` |
   | `AWS_REGION` | `us-east-1` |
   | `LOG_LEVEL` | `INFO` |

6. **Instance role**: Attach a role with `bedrock:InvokeModel` permission
7. Click **Create & deploy**

#### 1.4 Create Bedrock Instance Role

The App Runner instance needs permission to call Bedrock:

```bash
# Create the instance role
aws iam create-role \
    --role-name AppRunnerBedrockRole \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "tasks.apprunner.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }'

# Attach Bedrock access
aws iam put-role-policy \
    --role-name AppRunnerBedrockRole \
    --policy-name BedrockInvokeAccess \
    --policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Action": "bedrock:InvokeModel",
            "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.*"
        }]
    }'
```

#### 1.5 Verify Backend

```bash
curl https://YOUR-APP-RUNNER-URL/health
# Expected: {"status":"healthy","version":"1.0.0"}
```

---

## Phase 2: Frontend Deployment (Vercel)

1. Go to [vercel.com/new](https://vercel.com/new) and import your GitHub repo
2. Set **Root Directory** to `frontend`
3. Add environment variable:

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://YOUR-APP-RUNNER-URL` |

4. Click **Deploy**

Vercel auto-deploys on every push to `main`.

---

## Phase 3: Post-Deployment Configuration

### 3.1 Update CORS in App Runner

After getting your Vercel URL, update the backend CORS:

1. Go to **App Runner** → **pr-summarizer-api** → **Configuration**
2. Update `ALLOWED_ORIGINS` to your Vercel domain (e.g., `https://your-app.vercel.app`)
3. Click **Apply configuration changes**
4. Wait for the service to reach `RUNNING` status

### 3.2 Set Up GitHub Actions CI/CD

The workflow at `.github/workflows/deploy-backend.yml` auto-deploys on push to `main`.

**Required GitHub repo secrets:**

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_REGION` | AWS region (default: us-east-1) |
| `APP_RUNNER_SERVICE_ARN` | ARN from App Runner console |

---

## Verification Checklist

1. **Backend health**: `curl https://YOUR-APP-RUNNER-URL/health`
2. **Frontend**: Open your Vercel URL, enter a public repo (e.g., `facebook/react`), verify summaries load
3. **CORS**: Check browser DevTools → Network tab for CORS errors
4. **CI/CD**: Push a change to `backend/` and verify GitHub Actions deploys successfully

---

## Troubleshooting

### App Runner Deployment Fails
- Check CloudWatch logs: App Runner → your service → Logs
- Use `gh run view <run-id> --log-failed` for GitHub Actions failures
- App Runner must be in `RUNNING` state before triggering deployments — if it's `OPERATION_IN_PROGRESS`, wait

### Docker Image Architecture
- App Runner only supports `linux/amd64`
- On ARM Macs, always build with `--platform linux/amd64`
- Verify with: `docker inspect <image> | grep Architecture`

### Bedrock Access Denied
- Verify the App Runner instance role has `bedrock:InvokeModel` permission
- Check that you've requested model access in the Bedrock console
- Model access requests can take ~15 minutes to process

### CORS Errors
- Verify `ALLOWED_ORIGINS` matches your Vercel domain exactly (no trailing slash)
- After updating, wait for App Runner to reach `RUNNING` status

---

## Estimated Monthly Costs

| Service | Estimated Cost |
|---------|---------------|
| App Runner (1 vCPU, 2GB, low traffic) | ~$7-15 |
| ECR Storage | ~$0.10 |
| Bedrock (Claude Haiku) | ~$0.001/request |
| Vercel | Free (Hobby plan) |
| GitHub Actions | Free (public repos) |
| **Total** | **~$7-15/month** |

---

## Security Best Practices

- Restrict `ALLOWED_ORIGINS` to your specific Vercel domain
- Use IAM roles with least-privilege (separate ECR access role and Bedrock instance role)
- Enable ECR image scanning for vulnerabilities
- GitHub tokens are never stored server-side — passed per-request
- Rotate AWS credentials periodically
