import axios, { AxiosInstance } from 'axios';
import {
  PRListResponse,
  PRSummary,
  IssueListResponse,
  IssueSummary,
  HealthResponse,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minute timeout for AI summarization
});

export async function checkHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
}

export async function fetchPRs(
  owner: string,
  repo: string,
  githubToken: string
): Promise<PRListResponse> {
  const response = await apiClient.post<PRListResponse>(
    `/api/v1/repos/${owner}/${repo}/pulls`,
    { github_token: githubToken }
  );
  return response.data;
}

export async function fetchPRSummary(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken: string
): Promise<PRSummary> {
  const response = await apiClient.post<PRSummary>(
    `/api/v1/repos/${owner}/${repo}/pulls/${prNumber}`,
    { github_token: githubToken }
  );
  return response.data;
}

export async function fetchIssues(
  owner: string,
  repo: string,
  githubToken: string
): Promise<IssueListResponse> {
  const response = await apiClient.post<IssueListResponse>(
    `/api/v1/repos/${owner}/${repo}/issues`,
    { github_token: githubToken }
  );
  return response.data;
}

export async function fetchIssueSummary(
  owner: string,
  repo: string,
  issueNumber: number,
  githubToken: string
): Promise<IssueSummary> {
  const response = await apiClient.post<IssueSummary>(
    `/api/v1/repos/${owner}/${repo}/issues/${issueNumber}`,
    { github_token: githubToken }
  );
  return response.data;
}
