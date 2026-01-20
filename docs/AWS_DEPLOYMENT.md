# AWS Deployment Guide - PR & Issue Summarizer

This guide walks you through deploying the PR & Issue Summarizer to AWS using:
- **Backend**: AWS App Runner (containerized FastAPI)
- **Frontend**: AWS Amplify (Next.js SSR)

## Prerequisites

Before starting, ensure you have:

1. **AWS Account** with appropriate permissions for:
   - ECR (Elastic Container Registry)
   - App Runner
   - Amplify
   - IAM (for creating roles)

2. **AWS CLI** installed and configured:
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region
   ```

3. **Docker** installed and running locally

4. **GitHub repository** with your code (for Amplify CI/CD)

5. **Anthropic API Key** for Claude AI summaries

---

## Phase 1: Backend Deployment (AWS App Runner)

### Option A: Using the Deployment Script (Recommended)

We provide a deployment script that automates ECR setup and image pushing.

```bash
# Make the script executable
chmod +x scripts/deploy-backend.sh

# Run the deployment script
./scripts/deploy-backend.sh

# Or with custom options:
./scripts/deploy-backend.sh --region us-west-2 --tag v1.0.0
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
# Get your AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
    docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com

# Build the image
cd pr-summarizer/backend
docker build -t pr-summarizer-backend .

# Tag for ECR
docker tag pr-summarizer-backend:latest \
    ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/pr-summarizer-backend:latest

# Push to ECR
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/pr-summarizer-backend:latest
```

#### 1.3 Create App Runner Service

**Via AWS Console (Recommended for first-time setup):**

1. Navigate to **AWS App Runner** → **Create Service**
2. **Source Configuration:**
   - Source: Container registry
   - Provider: Amazon ECR
   - Browse and select your image
3. **Deployment Settings:**
   - Deployment trigger: Manual (or Automatic for CI/CD)
4. **Configure Service:**
   - Service name: `pr-summarizer-api`
   - CPU: 1 vCPU
   - Memory: 2 GB
   - Port: 8000
5. **Health Check:**
   - Protocol: HTTP
   - Path: `/health`
6. **Environment Variables:**

   | Variable | Value | Description |
   |----------|-------|-------------|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Claude API key |
   | `ALLOWED_ORIGINS` | `*` | Update after Amplify deploy |
   | `LOG_LEVEL` | `INFO` | Logging level |

7. Click **Create & deploy**

**Via AWS CLI:**

```bash
# Create IAM role for ECR access
aws iam create-role \
    --role-name AppRunnerECRAccessRole \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "build.apprunner.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }'

aws iam attach-role-policy \
    --role-name AppRunnerECRAccessRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess

# Create App Runner service
aws apprunner create-service \
    --service-name pr-summarizer-api \
    --source-configuration '{
        "AuthenticationConfiguration": {
            "AccessRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/AppRunnerECRAccessRole"
        },
        "ImageRepository": {
            "ImageIdentifier": "YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/pr-summarizer-backend:latest",
            "ImageRepositoryType": "ECR",
            "ImageConfiguration": {
                "Port": "8000",
                "RuntimeEnvironmentVariables": {
                    "ANTHROPIC_API_KEY": "sk-ant-your-key",
                    "ALLOWED_ORIGINS": "*",
                    "LOG_LEVEL": "INFO"
                }
            }
        }
    }' \
    --instance-configuration '{"Cpu": "1024", "Memory": "2048"}' \
    --health-check-configuration '{"Protocol": "HTTP", "Path": "/health"}'
```

#### 1.4 Note the App Runner URL

After deployment completes, note the service URL:
```
https://xxxxx.us-east-1.awsapprunner.com
```

Verify the backend is working:
```bash
curl https://xxxxx.us-east-1.awsapprunner.com/health
# Expected: {"status":"healthy","version":"1.0.0"}
```

---

## Phase 2: Frontend Deployment (AWS Amplify)

### 2.1 Push Code to GitHub

Ensure your code is in a GitHub repository. Amplify will use this for CI/CD.

### 2.2 Create Amplify App

1. Navigate to **AWS Amplify** → **New app** → **Host web app**
2. **Connect Repository:**
   - Select GitHub and authorize
   - Choose your repository and branch (e.g., `main`)
3. **Build Settings:**
   - App name: `pr-summarizer`
   - Monorepo settings: Check "My app is a monorepo"
   - Root directory: `pr-summarizer/frontend`
   - Build command: `npm run build`
   - Output directory: `.next`
   - Framework: Next.js - SSR

4. **Advanced Settings** → **Environment variables:**

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://xxxxx.us-east-1.awsapprunner.com` |

5. Click **Save and deploy**

### 2.3 Amplify Build Specification

The `amplify.yml` file is already configured in `frontend/amplify.yml`:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - echo "Building with NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL"
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### 2.4 Note the Amplify URL

After deployment, note your Amplify URL:
```
https://main.d1234567890.amplifyapp.com
```

---

## Phase 3: Post-Deployment Configuration

### 3.1 Update CORS in App Runner

Now that you have the Amplify URL, update the backend CORS settings:

1. Go to **App Runner** → **pr-summarizer-api** → **Configuration**
2. Update the `ALLOWED_ORIGINS` environment variable:
   ```
   https://main.d1234567890.amplifyapp.com
   ```
3. Click **Apply configuration changes**
4. Wait for the service to redeploy

### 3.2 Custom Domain (Optional)

**For Amplify:**
1. Amplify Console → Domain management → Add domain
2. Enter your domain name
3. Follow the DNS verification steps (add CNAME records)

**For App Runner:**
1. App Runner → pr-summarizer-api → Custom domains
2. Click "Link domain"
3. Add the CNAME record to your DNS provider

---

## Verification Checklist

### 1. Backend Health Check
```bash
curl https://YOUR-APP-RUNNER-URL/health
# Expected: {"status":"healthy","version":"1.0.0"}
```

### 2. Frontend Test
1. Open `https://YOUR-AMPLIFY-URL`
2. Enter a GitHub Personal Access Token
3. Enter a repository (e.g., `facebook/react`)
4. Verify PRs load with AI summaries

### 3. CORS Test
Open browser DevTools → Network tab → Verify no CORS errors on API calls

---

## Troubleshooting

### Backend Issues

**Container won't start:**
- Check App Runner logs in CloudWatch
- Verify the health check path is `/health`
- Ensure port 8000 is exposed

**CORS errors:**
- Verify `ALLOWED_ORIGINS` includes your Amplify domain
- Ensure the origin doesn't have a trailing slash

**AI summaries not working:**
- Verify `ANTHROPIC_API_KEY` is set correctly
- Check CloudWatch logs for API errors

### Frontend Issues

**Build failures:**
- Check Amplify build logs
- Verify `NEXT_PUBLIC_API_URL` is set before build
- Ensure `npm ci` can install all dependencies

**API calls failing:**
- Verify the API URL is correct
- Check browser network tab for actual error responses
- Ensure CORS is configured correctly

---

## Estimated Monthly Costs

| Service | Estimated Cost |
|---------|---------------|
| App Runner (1 vCPU, 2GB, low traffic) | ~$5-15 |
| Amplify Hosting (SSR) | ~$0-5 (free tier covers most) |
| ECR Storage | ~$0.10/GB |
| CloudWatch Logs | ~$0.50/GB ingested |
| Claude API | Pay per use |
| **Total** | **~$10-25/month** |

---

## Rollback Procedures

### App Runner Rollback

```bash
# List previous deployments
aws apprunner list-operations \
    --service-arn YOUR_SERVICE_ARN

# Redeploy previous image version
aws apprunner update-service \
    --service-arn YOUR_SERVICE_ARN \
    --source-configuration '{"ImageRepository": {"ImageIdentifier": "YOUR_ECR_URI:previous-tag"}}'
```

### Amplify Rollback

1. Go to Amplify Console → Your App → Hosting
2. Find the previous successful build
3. Click "Redeploy this version"

---

## Security Best Practices

- [ ] Store `ANTHROPIC_API_KEY` as environment variable (never in code)
- [ ] Restrict `ALLOWED_ORIGINS` to specific domains only
- [ ] Enable ECR image scanning for vulnerabilities
- [ ] Use IAM roles with least-privilege access
- [ ] Enable AWS CloudTrail for audit logging
- [ ] Consider adding AWS WAF for additional protection
- [ ] Rotate API keys periodically
- [ ] Monitor CloudWatch metrics and set up alerts

---

## CI/CD Automation

### Automatic Backend Deployments

Enable auto-deployments in App Runner:
1. App Runner → pr-summarizer-api → Configuration
2. Under "Deployment settings", enable automatic deployments
3. New images pushed to ECR will automatically deploy

### GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd pr-summarizer/backend
          docker build -t $ECR_REGISTRY/pr-summarizer-backend:$IMAGE_TAG .
          docker push $ECR_REGISTRY/pr-summarizer-backend:$IMAGE_TAG
          docker tag $ECR_REGISTRY/pr-summarizer-backend:$IMAGE_TAG $ECR_REGISTRY/pr-summarizer-backend:latest
          docker push $ECR_REGISTRY/pr-summarizer-backend:latest
```

Amplify automatically deploys on push to the connected branch.
