'use client';

import { IssueSummary } from '@/types';
import SummaryCard from './SummaryCard';
import LoadingSpinner from './LoadingSpinner';

interface IssueListProps {
  issues: IssueSummary[];
  loading: boolean;
  error: string | null;
  totalCount?: number;
}

export default function IssueList({ issues, loading, error, totalCount }: IssueListProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Summarizing Issues" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="font-semibold text-red-800 mb-1">Error fetching issues</h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="font-semibold text-gray-700 mb-1">No issues found</h3>
        <p className="text-sm text-gray-500">Select a repository to get started</p>
      </div>
    );
  }

  return (
    <div>
      {totalCount !== undefined && totalCount > issues.length && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Showing {issues.length} of {totalCount} open issues (limited to avoid rate limits)
        </div>
      )}
      <div className="space-y-4">
        {issues.map((issue) => (
          <SummaryCard key={issue.number} type="issue" data={issue} />
        ))}
      </div>
    </div>
  );
}
