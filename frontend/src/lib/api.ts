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

// --- SSE streaming functions ---

interface StreamCallbacks<T> {
  onMetadata: (totalCount: number, processingCount: number) => void;
  onSummary: (summary: T) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

export function streamPRs(
  owner: string,
  repo: string,
  githubToken: string,
  callbacks: StreamCallbacks<PRSummary>
): AbortController {
  const controller = new AbortController();

  fetch(`${API_URL}/api/v1/repos/${owner}/${repo}/pulls/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_token: githubToken }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        callbacks.onError(error.detail || `HTTP ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError('Stream not available');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'metadata') {
                callbacks.onMetadata(event.total_count, event.processing_count);
              } else if (event.type === 'summary') {
                callbacks.onSummary(event.data as PRSummary);
              } else if (event.type === 'done') {
                callbacks.onDone();
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError(err.message || 'Stream failed');
      }
    });

  return controller;
}

export function streamIssues(
  owner: string,
  repo: string,
  githubToken: string,
  callbacks: StreamCallbacks<IssueSummary>
): AbortController {
  const controller = new AbortController();

  fetch(`${API_URL}/api/v1/repos/${owner}/${repo}/issues/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ github_token: githubToken }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        callbacks.onError(error.detail || `HTTP ${response.status}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError('Stream not available');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'metadata') {
                callbacks.onMetadata(event.total_count, event.processing_count);
              } else if (event.type === 'summary') {
                callbacks.onSummary(event.data as IssueSummary);
              } else if (event.type === 'done') {
                callbacks.onDone();
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        callbacks.onError(err.message || 'Stream failed');
      }
    });

  return controller;
}

// --- Legacy batch functions (kept for backward compatibility) ---

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
