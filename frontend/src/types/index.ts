export type RiskTag =
  | 'breaking-change'
  | 'security'
  | 'performance'
  | 'database'
  | 'api-change'
  | 'ui-change'
  | 'dependency'
  | 'testing'
  | 'documentation'
  | 'refactoring';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface PRSummary {
  number: number;
  title: string;
  summary: string;
  risk_tags: RiskTag[];
  test_checklist: string[];
  pr_url: string;
  state: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface IssueSummary {
  number: number;
  title: string;
  summary: string;
  priority: Priority;
  action_items: string[];
  issue_url: string;
  state: string;
  author: string;
  labels: string[];
  created_at: string;
  updated_at: string;
}

export interface PRListResponse {
  owner: string;
  repo: string;
  total_count: number;
  pull_requests: PRSummary[];
}

export interface IssueListResponse {
  owner: string;
  repo: string;
  total_count: number;
  issues: IssueSummary[];
}

export interface HealthResponse {
  status: string;
  version: string;
}
