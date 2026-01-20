from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class RiskTag(str, Enum):
    BREAKING_CHANGE = "breaking-change"
    SECURITY = "security"
    PERFORMANCE = "performance"
    DATABASE = "database"
    API_CHANGE = "api-change"
    UI_CHANGE = "ui-change"
    DEPENDENCY = "dependency"
    TESTING = "testing"
    DOCUMENTATION = "documentation"
    REFACTORING = "refactoring"


class Priority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class GitHubTokenRequest(BaseModel):
    """Base request with GitHub token."""
    github_token: str = Field(..., description="GitHub Personal Access Token")


class PRRequest(GitHubTokenRequest):
    """Request for PR operations."""
    pass


class IssueRequest(GitHubTokenRequest):
    """Request for issue operations."""
    pass


class PRSummary(BaseModel):
    """Summary of a pull request."""
    number: int
    title: str
    summary: str
    risk_tags: list[RiskTag]
    test_checklist: list[str]
    pr_url: str
    state: str
    author: str
    created_at: str
    updated_at: str


class IssueSummary(BaseModel):
    """Summary of an issue."""
    number: int
    title: str
    summary: str
    priority: Priority
    action_items: list[str]
    issue_url: str
    state: str
    author: str
    labels: list[str]
    created_at: str
    updated_at: str


class PRListResponse(BaseModel):
    """Response containing list of PR summaries."""
    owner: str
    repo: str
    total_count: int
    pull_requests: list[PRSummary]


class IssueListResponse(BaseModel):
    """Response containing list of issue summaries."""
    owner: str
    repo: str
    total_count: int
    issues: list[IssueSummary]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str


class ErrorResponse(BaseModel):
    """Error response."""
    detail: str
    error_code: Optional[str] = None
