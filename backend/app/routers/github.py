from fastapi import APIRouter, HTTPException
import httpx
import logging
import asyncio

from app.models.schemas import (
    PRRequest,
    IssueRequest,
    PRSummary,
    IssueSummary,
    PRListResponse,
    IssueListResponse,
)
from app.services.github_service import GitHubService
from app.services.openai_service import OpenAIService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/repos", tags=["github"])


@router.post("/{owner}/{repo}/pulls", response_model=PRListResponse)
async def list_pull_requests(owner: str, repo: str, request: PRRequest) -> PRListResponse:
    """Fetch and summarize all open pull requests for a repository."""
    try:
        github_service = GitHubService(request.github_token)
        openai_service = OpenAIService()

        # Fetch PRs
        prs = await github_service.fetch_pull_requests(owner, repo)

        # Summarize each PR (limit to 5)
        summaries = []
        for pr in prs[:5]:
            try:
                # Fetch full PR details with diff
                pr_details = await github_service.fetch_pr_details(owner, repo, pr["number"])
                summary = await openai_service.summarize_pr(pr_details)
                summaries.append(summary)
                await asyncio.sleep(1)  # Delay to avoid rate limiting
            except Exception as e:
                logger.error(f"Error summarizing PR #{pr['number']}: {e}")
                # Continue with other PRs

        return PRListResponse(
            owner=owner,
            repo=repo,
            total_count=len(prs),
            pull_requests=summaries,
        )

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        elif e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching PRs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{owner}/{repo}/pulls/{pr_number}", response_model=PRSummary)
async def get_pull_request_summary(
    owner: str, repo: str, pr_number: int, request: PRRequest
) -> PRSummary:
    """Fetch and summarize a specific pull request."""
    try:
        github_service = GitHubService(request.github_token)
        openai_service = OpenAIService()

        pr_details = await github_service.fetch_pr_details(owner, repo, pr_number)
        summary = await openai_service.summarize_pr(pr_details)

        return summary

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        elif e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Pull request not found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching PR #{pr_number}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{owner}/{repo}/issues", response_model=IssueListResponse)
async def list_issues(owner: str, repo: str, request: IssueRequest) -> IssueListResponse:
    """Fetch and summarize all open issues for a repository."""
    try:
        github_service = GitHubService(request.github_token)
        openai_service = OpenAIService()

        # Fetch issues
        issues = await github_service.fetch_issues(owner, repo)

        # Summarize each issue (limit to 5)
        summaries = []
        for issue in issues[:5]:
            try:
                issue_details = await github_service.fetch_issue_details(owner, repo, issue["number"])
                summary = await openai_service.summarize_issue(issue_details)
                summaries.append(summary)
                await asyncio.sleep(1)  # Delay to avoid rate limiting
            except Exception as e:
                logger.error(f"Error summarizing issue #{issue['number']}: {e}")
                # Continue with other issues

        return IssueListResponse(
            owner=owner,
            repo=repo,
            total_count=len(issues),
            issues=summaries,
        )

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        elif e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching issues: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{owner}/{repo}/issues/{issue_number}", response_model=IssueSummary)
async def get_issue_summary(
    owner: str, repo: str, issue_number: int, request: IssueRequest
) -> IssueSummary:
    """Fetch and summarize a specific issue."""
    try:
        github_service = GitHubService(request.github_token)
        openai_service = OpenAIService()

        issue_details = await github_service.fetch_issue_details(owner, repo, issue_number)
        summary = await openai_service.summarize_issue(issue_details)

        return summary

    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        elif e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Issue not found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching issue #{issue_number}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
