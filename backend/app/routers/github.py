from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import httpx
import logging
import asyncio
import json

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


async def _fetch_and_summarize_pr(
    github_service: GitHubService,
    openai_service: OpenAIService,
    owner: str,
    repo: str,
    pr: dict,
) -> PRSummary | None:
    """Fetch PR details and generate summary."""
    try:
        pr_details = await github_service.fetch_pr_details(owner, repo, pr["number"])
        return await openai_service.summarize_pr(pr_details)
    except Exception as e:
        logger.error(f"Error summarizing PR #{pr['number']}: {e}")
        return None


async def _fetch_and_summarize_issue(
    github_service: GitHubService,
    openai_service: OpenAIService,
    owner: str,
    repo: str,
    issue: dict,
) -> IssueSummary | None:
    """Fetch issue details and generate summary."""
    try:
        issue_details = await github_service.fetch_issue_details(owner, repo, issue["number"])
        return await openai_service.summarize_issue(issue_details)
    except Exception as e:
        logger.error(f"Error summarizing issue #{issue['number']}: {e}")
        return None


# --- SSE streaming endpoints ---

@router.post("/{owner}/{repo}/pulls/stream")
async def stream_pull_requests(owner: str, repo: str, request: PRRequest):
    """Stream PR summaries as Server-Sent Events."""
    try:
        github_service = GitHubService(request.github_token)
        prs = await github_service.fetch_pull_requests(owner, repo)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        elif e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))

    async def event_generator():
        # Send metadata first
        yield f"data: {json.dumps({'type': 'metadata', 'total_count': len(prs), 'processing_count': min(5, len(prs))})}\n\n"

        openai_service = OpenAIService()
        tasks = []
        for pr in prs[:5]:
            tasks.append(_fetch_and_summarize_pr(github_service, openai_service, owner, repo, pr))

        # Use asyncio.as_completed to stream results as they finish
        for coro in asyncio.as_completed(tasks):
            summary = await coro
            if summary:
                yield f"data: {json.dumps({'type': 'summary', 'data': summary.model_dump()})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{owner}/{repo}/issues/stream")
async def stream_issues(owner: str, repo: str, request: IssueRequest):
    """Stream issue summaries as Server-Sent Events."""
    try:
        github_service = GitHubService(request.github_token)
        issues = await github_service.fetch_issues(owner, repo)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid GitHub token")
        elif e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))

    async def event_generator():
        yield f"data: {json.dumps({'type': 'metadata', 'total_count': len(issues), 'processing_count': min(5, len(issues))})}\n\n"

        openai_service = OpenAIService()
        tasks = []
        for issue in issues[:5]:
            tasks.append(_fetch_and_summarize_issue(github_service, openai_service, owner, repo, issue))

        for coro in asyncio.as_completed(tasks):
            summary = await coro
            if summary:
                yield f"data: {json.dumps({'type': 'summary', 'data': summary.model_dump()})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --- Original batch endpoints (kept for backward compatibility) ---

@router.post("/{owner}/{repo}/pulls", response_model=PRListResponse)
async def list_pull_requests(owner: str, repo: str, request: PRRequest) -> PRListResponse:
    """Fetch and summarize all open pull requests for a repository."""
    try:
        github_service = GitHubService(request.github_token)
        openai_service = OpenAIService()

        prs = await github_service.fetch_pull_requests(owner, repo)

        # Summarize PRs in parallel
        tasks = [
            _fetch_and_summarize_pr(github_service, openai_service, owner, repo, pr)
            for pr in prs[:5]
        ]
        results = await asyncio.gather(*tasks)
        summaries = [s for s in results if s is not None]

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

        issues = await github_service.fetch_issues(owner, repo)

        # Summarize issues in parallel
        tasks = [
            _fetch_and_summarize_issue(github_service, openai_service, owner, repo, issue)
            for issue in issues[:5]
        ]
        results = await asyncio.gather(*tasks)
        summaries = [s for s in results if s is not None]

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
