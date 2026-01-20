#!/bin/bash

# AWS Deployment Script for PR Summarizer Backend
# This script pushes the Docker image to ECR and optionally creates/updates App Runner service

set -e

# Configuration - Update these values
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO_NAME="${ECR_REPO_NAME:-pr-summarizer-backend}"
APP_RUNNER_SERVICE_NAME="${APP_RUNNER_SERVICE_NAME:-pr-summarizer-api}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."

    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi

    print_status "Prerequisites check passed."
}

# Get AWS Account ID
get_account_id() {
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    print_status "AWS Account ID: ${AWS_ACCOUNT_ID}"
}

# Create ECR repository if it doesn't exist
create_ecr_repo() {
    print_status "Checking ECR repository..."

    if aws ecr describe-repositories --repository-names "${ECR_REPO_NAME}" --region "${AWS_REGION}" &> /dev/null; then
        print_status "ECR repository '${ECR_REPO_NAME}' already exists."
    else
        print_status "Creating ECR repository '${ECR_REPO_NAME}'..."
        aws ecr create-repository \
            --repository-name "${ECR_REPO_NAME}" \
            --region "${AWS_REGION}" \
            --image-scanning-configuration scanOnPush=true \
            --image-tag-mutability MUTABLE
        print_status "ECR repository created successfully."
    fi
}

# Login to ECR
ecr_login() {
    print_status "Logging in to ECR..."
    aws ecr get-login-password --region "${AWS_REGION}" | \
        docker login --username AWS --password-stdin "${ECR_URI}"
    print_status "ECR login successful."
}

# Build Docker image
build_image() {
    print_status "Building Docker image..."

    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    BACKEND_DIR="${SCRIPT_DIR}/../backend"

    docker build -t "${ECR_REPO_NAME}:${IMAGE_TAG}" "${BACKEND_DIR}"
    print_status "Docker image built successfully."
}

# Tag and push image
push_image() {
    print_status "Tagging image..."
    docker tag "${ECR_REPO_NAME}:${IMAGE_TAG}" "${ECR_URI}/${ECR_REPO_NAME}:${IMAGE_TAG}"

    print_status "Pushing image to ECR..."
    docker push "${ECR_URI}/${ECR_REPO_NAME}:${IMAGE_TAG}"
    print_status "Image pushed successfully."

    echo ""
    print_status "Image URI: ${ECR_URI}/${ECR_REPO_NAME}:${IMAGE_TAG}"
}

# Create App Runner service (optional)
create_app_runner_service() {
    print_status "Creating App Runner service..."

    # Check if service already exists
    if aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='${APP_RUNNER_SERVICE_NAME}'].ServiceArn" --output text | grep -q .; then
        print_warning "App Runner service '${APP_RUNNER_SERVICE_NAME}' already exists."
        print_status "To update the service, use the AWS Console or update-service command."
        return
    fi

    # Create IAM role for App Runner to access ECR
    ROLE_NAME="AppRunnerECRAccessRole"

    if ! aws iam get-role --role-name "${ROLE_NAME}" &> /dev/null; then
        print_status "Creating IAM role for App Runner ECR access..."

        aws iam create-role \
            --role-name "${ROLE_NAME}" \
            --assume-role-policy-document '{
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {
                            "Service": "build.apprunner.amazonaws.com"
                        },
                        "Action": "sts:AssumeRole"
                    }
                ]
            }'

        aws iam attach-role-policy \
            --role-name "${ROLE_NAME}" \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess

        # Wait for role to propagate
        sleep 10
    fi

    ROLE_ARN=$(aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text)

    print_status "Creating App Runner service (this may take a few minutes)..."

    aws apprunner create-service \
        --service-name "${APP_RUNNER_SERVICE_NAME}" \
        --source-configuration "{
            \"AuthenticationConfiguration\": {
                \"AccessRoleArn\": \"${ROLE_ARN}\"
            },
            \"AutoDeploymentsEnabled\": true,
            \"ImageRepository\": {
                \"ImageIdentifier\": \"${ECR_URI}/${ECR_REPO_NAME}:${IMAGE_TAG}\",
                \"ImageRepositoryType\": \"ECR\",
                \"ImageConfiguration\": {
                    \"Port\": \"8000\",
                    \"RuntimeEnvironmentVariables\": {
                        \"LOG_LEVEL\": \"INFO\",
                        \"ALLOWED_ORIGINS\": \"*\"
                    }
                }
            }
        }" \
        --instance-configuration "{
            \"Cpu\": \"1024\",
            \"Memory\": \"2048\"
        }" \
        --health-check-configuration "{
            \"Protocol\": \"HTTP\",
            \"Path\": \"/health\",
            \"Interval\": 10,
            \"Timeout\": 5,
            \"HealthyThreshold\": 1,
            \"UnhealthyThreshold\": 5
        }" \
        --region "${AWS_REGION}"

    print_status "App Runner service creation initiated."
    print_warning "IMPORTANT: After deployment, update the environment variables in the AWS Console:"
    print_warning "  - ANTHROPIC_API_KEY: Your Claude API key"
    print_warning "  - ALLOWED_ORIGINS: Your Amplify frontend URL"
}

# Print deployment summary
print_summary() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}Deployment Summary${NC}"
    echo "=============================================="
    echo "ECR Repository: ${ECR_REPO_NAME}"
    echo "Image URI: ${ECR_URI}/${ECR_REPO_NAME}:${IMAGE_TAG}"
    echo "Region: ${AWS_REGION}"
    echo ""
    echo "Next Steps:"
    echo "1. Go to AWS Console > App Runner"
    echo "2. Create a new service using the ECR image above"
    echo "3. Configure environment variables:"
    echo "   - ANTHROPIC_API_KEY: sk-ant-..."
    echo "   - ALLOWED_ORIGINS: https://your-amplify-domain.amplifyapp.com"
    echo "   - LOG_LEVEL: INFO"
    echo "4. Set health check path to: /health"
    echo "5. Note the App Runner service URL for frontend configuration"
    echo "=============================================="
}

# Main execution
main() {
    echo ""
    echo "=============================================="
    echo "PR Summarizer Backend - AWS Deployment"
    echo "=============================================="
    echo ""

    check_prerequisites
    get_account_id
    create_ecr_repo
    ecr_login
    build_image
    push_image

    # Ask if user wants to create App Runner service
    if [ "${CREATE_APP_RUNNER:-false}" = "true" ]; then
        create_app_runner_service
    fi

    print_summary
}

# Parse command line arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --region) AWS_REGION="$2"; shift ;;
        --repo-name) ECR_REPO_NAME="$2"; shift ;;
        --tag) IMAGE_TAG="$2"; shift ;;
        --create-app-runner) CREATE_APP_RUNNER=true ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --region REGION        AWS region (default: us-east-1)"
            echo "  --repo-name NAME       ECR repository name (default: pr-summarizer-backend)"
            echo "  --tag TAG              Image tag (default: latest)"
            echo "  --create-app-runner    Also create App Runner service"
            echo "  --help                 Show this help message"
            exit 0
            ;;
        *) print_error "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

main
