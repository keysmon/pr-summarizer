'use client';

import { useState, useCallback } from 'react';
import TokenInput from '@/components/TokenInput';
import RepoSelector from '@/components/RepoSelector';
import PRList from '@/components/PRList';
import IssueList from '@/components/IssueList';
import { fetchPRs, fetchIssues } from '@/lib/api';
import { PRSummary, IssueSummary } from '@/types';

type Tab = 'prs' | 'issues';

export default function Home() {
  const [githubToken, setGithubToken] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('prs');

  const [prs, setPRs] = useState<PRSummary[]>([]);
  const [prsTotalCount, setPRsTotalCount] = useState<number | undefined>();
  const [prsLoading, setPRsLoading] = useState(false);
  const [prsError, setPRsError] = useState<string | null>(null);

  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [issuesTotalCount, setIssuesTotalCount] = useState<number | undefined>();
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const [currentRepo, setCurrentRepo] = useState<{ owner: string; repo: string } | null>(null);

  const handleTokenChange = useCallback((token: string) => {
    setGithubToken(token);
  }, []);

  const handleRepoSelect = async (owner: string, repo: string) => {
    if (!githubToken) {
      setPRsError('Please enter a GitHub token first');
      return;
    }

    setCurrentRepo({ owner, repo });
    // Reset previous data
    setPRs([]);
    setIssues([]);
    setPRsTotalCount(undefined);
    setIssuesTotalCount(undefined);

    // Fetch based on active tab
    if (activeTab === 'prs') {
      await loadPRs(owner, repo);
    } else {
      await loadIssues(owner, repo);
    }
  };

  const loadPRs = async (owner: string, repo: string) => {
    setPRsLoading(true);
    setPRsError(null);
    try {
      const response = await fetchPRs(owner, repo, githubToken);
      setPRs(response.pull_requests);
      setPRsTotalCount(response.total_count);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to fetch PRs';
      setPRsError(errorMsg);
      setPRs([]);
    } finally {
      setPRsLoading(false);
    }
  };

  const loadIssues = async (owner: string, repo: string) => {
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const response = await fetchIssues(owner, repo, githubToken);
      setIssues(response.issues);
      setIssuesTotalCount(response.total_count);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to fetch issues';
      setIssuesError(errorMsg);
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  };

  const handleTabChange = async (tab: Tab) => {
    setActiveTab(tab);

    // Load data for the new tab if we have a repo selected
    if (currentRepo) {
      if (tab === 'prs' && prs.length === 0 && !prsLoading) {
        await loadPRs(currentRepo.owner, currentRepo.repo);
      } else if (tab === 'issues' && issues.length === 0 && !issuesLoading) {
        await loadIssues(currentRepo.owner, currentRepo.repo);
      }
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PR & Issue Summarizer</h1>
          <p className="text-gray-600">
            AI-powered summaries for GitHub pull requests and issues
          </p>
        </header>

        {/* Config Section */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <TokenInput onTokenChange={handleTokenChange} />
          <RepoSelector
            onRepoSelect={handleRepoSelect}
            disabled={!githubToken || prsLoading || issuesLoading}
          />
        </div>

        {/* Current Repo Badge */}
        {currentRepo && (
          <div className="mb-6 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              <a
                href={`https://github.com/${currentRepo.owner}/${currentRepo.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                {currentRepo.owner}/{currentRepo.repo}
              </a>
            </div>
          </div>
        )}

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex">
              <button
                onClick={() => handleTabChange('prs')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
                  activeTab === 'prs'
                    ? 'bg-white border-b-2 border-blue-600 text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  Pull Requests
                  {prsTotalCount !== undefined && (
                    <span className="ml-1 px-2.5 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full font-semibold">
                      {prs.length}/{prsTotalCount}
                    </span>
                  )}
                </div>
              </button>
              <button
                onClick={() => handleTabChange('issues')}
                className={`flex-1 px-6 py-4 text-sm font-medium transition-all ${
                  activeTab === 'issues'
                    ? 'bg-white border-b-2 border-blue-600 text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Issues
                  {issuesTotalCount !== undefined && (
                    <span className="ml-1 px-2.5 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-semibold">
                      {issues.length}/{issuesTotalCount}
                    </span>
                  )}
                </div>
              </button>
            </nav>
          </div>

          {/* Content Area with Scroll */}
          <div className="p-6 max-h-[600px] overflow-y-auto">
            {activeTab === 'prs' ? (
              <PRList
                prs={prs}
                loading={prsLoading}
                error={prsError}
                totalCount={prsTotalCount}
              />
            ) : (
              <IssueList
                issues={issues}
                loading={issuesLoading}
                error={issuesError}
                totalCount={issuesTotalCount}
              />
            )}
          </div>

          {/* Footer with info */}
          {(prs.length > 0 || issues.length > 0) && (
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center text-xs text-gray-500">
              Summaries generated by Claude AI. Click on a card to expand details.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
