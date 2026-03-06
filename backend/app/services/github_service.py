import httpx
from typing import Any
import logging

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"


class GitHubService:
    """Service for interacting with GitHub API."""

    def __init__(self, token: str = ""):
        self.token = token
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    async def fetch_pull_requests(
        self, owner: str, repo: str, state: str = "open", per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch list of pull requests for a repository."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls"
        params = {"state": state, "per_page": per_page, "sort": "updated", "direction": "desc"}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()

    async def fetch_pr_details(self, owner: str, repo: str, pr_number: int) -> dict[str, Any]:
        """Fetch details of a specific pull request including diff."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}"

        async with httpx.AsyncClient() as client:
            # Fetch PR details
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            pr_data = response.json()

            # Fetch diff
            diff_headers = {**self.headers, "Accept": "application/vnd.github.v3.diff"}
            diff_response = await client.get(url, headers=diff_headers)
            diff_response.raise_for_status()
            pr_data["diff"] = diff_response.text[:50000]  # Limit diff size

            return pr_data

    async def fetch_issues(
        self, owner: str, repo: str, state: str = "open", per_page: int = 30
    ) -> list[dict[str, Any]]:
        """Fetch list of issues for a repository (excluding PRs)."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/issues"
        params = {"state": state, "per_page": per_page, "sort": "updated", "direction": "desc"}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            issues = response.json()
            # Filter out pull requests (they appear in issues endpoint too)
            return [issue for issue in issues if "pull_request" not in issue]

    async def fetch_issue_details(self, owner: str, repo: str, issue_number: int) -> dict[str, Any]:
        """Fetch details of a specific issue."""
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/issues/{issue_number}"

        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=self.headers)
            response.raise_for_status()
            issue_data = response.json()

            # Fetch comments if any
            if issue_data.get("comments", 0) > 0:
                comments_url = f"{url}/comments"
                comments_response = await client.get(comments_url, headers=self.headers)
                comments_response.raise_for_status()
                issue_data["comments_data"] = comments_response.json()[:10]  # Limit to 10 comments

            return issue_data
