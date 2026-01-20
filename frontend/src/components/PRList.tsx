'use client';

import { PRSummary } from '@/types';
import SummaryCard from './SummaryCard';
import LoadingSpinner from './LoadingSpinner';

interface PRListProps {
  prs: PRSummary[];
  loading: boolean;
  error: string | null;
  totalCount?: number;
}

export default function PRList({ prs, loading, error, totalCount }: PRListProps) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Summarizing Pull Requests" />
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
        <h3 className="font-semibold text-red-800 mb-1">Error fetching pull requests</h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (prs.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="font-semibold text-gray-700 mb-1">No pull requests found</h3>
        <p className="text-sm text-gray-500">Select a repository to get started</p>
      </div>
    );
  }

  return (
    <div>
      {totalCount !== undefined && totalCount > prs.length && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Showing {prs.length} of {totalCount} open pull requests (limited to avoid rate limits)
        </div>
      )}
      <div className="space-y-4">
        {prs.map((pr) => (
          <SummaryCard key={pr.number} type="pr" data={pr} />
        ))}
      </div>
    </div>
  );
}
