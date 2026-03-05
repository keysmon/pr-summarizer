import anthropic
from typing import Any
import json
import re
import logging

from app.config import get_settings
from app.models.schemas import PRSummary, IssueSummary, RiskTag, Priority

logger = logging.getLogger(__name__)


def extract_json(text: str) -> dict:
    """Extract JSON from text, handling markdown code blocks."""
    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to extract from markdown code block
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try to find JSON object in text
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError(f"Could not extract JSON from response: {text[:200]}")


class OpenAIService:
    """Service for generating summaries using Claude via Amazon Bedrock."""

    def __init__(self):
        settings = get_settings()
        self.client = anthropic.AnthropicBedrock(aws_region=settings.aws_region)
        self.model = "anthropic.claude-3-haiku-20240307-v1:0"

    async def summarize_pr(self, pr_data: dict[str, Any]) -> PRSummary:
        """Generate summary for a pull request."""
        prompt = self._build_pr_prompt(pr_data)

        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ],
            system="""You are a code review assistant. Analyze pull requests and provide:
1. A concise summary (2-3 sentences)
2. Risk tags from: breaking-change, security, performance, database, api-change, ui-change, dependency, testing, documentation, refactoring
3. A test checklist with specific items to verify

Respond ONLY with valid JSON (no markdown, no code blocks):
{"summary": "string", "risk_tags": ["string"], "test_checklist": ["string"]}""",
        )

        # Extract text content from response
        response_text = message.content[0].text
        result = extract_json(response_text)

        # Validate risk tags
        valid_tags = []
        for tag in result.get("risk_tags", []):
            try:
                valid_tags.append(RiskTag(tag))
            except ValueError:
                logger.warning(f"Invalid risk tag: {tag}")

        return PRSummary(
            number=pr_data["number"],
            title=pr_data["title"],
            summary=result.get("summary", "No summary available"),
            risk_tags=valid_tags,
            test_checklist=result.get("test_checklist", []),
            pr_url=pr_data["html_url"],
            state=pr_data["state"],
            author=pr_data["user"]["login"],
            created_at=pr_data["created_at"],
            updated_at=pr_data["updated_at"],
        )

    async def summarize_issue(self, issue_data: dict[str, Any]) -> IssueSummary:
        """Generate summary for an issue."""
        prompt = self._build_issue_prompt(issue_data)

        message = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ],
            system="""You are a project management assistant. Analyze GitHub issues and provide:
1. A concise summary (2-3 sentences)
2. Priority level: critical, high, medium, or low
3. Action items - specific steps to address the issue

Respond ONLY with valid JSON (no markdown, no code blocks):
{"summary": "string", "priority": "string", "action_items": ["string"]}""",
        )

        # Extract text content from response
        response_text = message.content[0].text
        result = extract_json(response_text)

        # Validate priority
        try:
            priority = Priority(result.get("priority", "medium"))
        except ValueError:
            priority = Priority.MEDIUM

        return IssueSummary(
            number=issue_data["number"],
            title=issue_data["title"],
            summary=result.get("summary", "No summary available"),
            priority=priority,
            action_items=result.get("action_items", []),
            issue_url=issue_data["html_url"],
            state=issue_data["state"],
            author=issue_data["user"]["login"],
            labels=[label["name"] for label in issue_data.get("labels", [])],
            created_at=issue_data["created_at"],
            updated_at=issue_data["updated_at"],
        )

    def _build_pr_prompt(self, pr_data: dict[str, Any]) -> str:
        """Build prompt for PR analysis."""
        parts = [
            f"# Pull Request #{pr_data['number']}: {pr_data['title']}",
            f"\n## Author: {pr_data['user']['login']}",
            f"\n## Description:\n{pr_data.get('body') or 'No description provided'}",
        ]

        if pr_data.get("diff"):
            # Truncate diff if too long
            diff = pr_data["diff"][:20000]
            parts.append(f"\n## Code Changes (diff):\n```diff\n{diff}\n```")

        return "\n".join(parts)

    def _build_issue_prompt(self, issue_data: dict[str, Any]) -> str:
        """Build prompt for issue analysis."""
        parts = [
            f"# Issue #{issue_data['number']}: {issue_data['title']}",
            f"\n## Author: {issue_data['user']['login']}",
        ]

        if issue_data.get("labels"):
            labels = ", ".join(label["name"] for label in issue_data["labels"])
            parts.append(f"\n## Labels: {labels}")

        parts.append(f"\n## Description:\n{issue_data.get('body') or 'No description provided'}")

        if issue_data.get("comments_data"):
            parts.append("\n## Recent Comments:")
            for comment in issue_data["comments_data"][:5]:
                parts.append(f"\n- {comment['user']['login']}: {comment['body'][:500]}")

        return "\n".join(parts)
