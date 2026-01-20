'use client';

import { useState } from 'react';
import { PRSummary, IssueSummary, RiskTag, Priority } from '@/types';

interface PRSummaryCardProps {
  type: 'pr';
  data: PRSummary;
}

interface IssueSummaryCardProps {
  type: 'issue';
  data: IssueSummary;
}

type SummaryCardProps = PRSummaryCardProps | IssueSummaryCardProps;

const riskTagColors: Record<RiskTag, string> = {
  'breaking-change': 'bg-red-100 text-red-700 border-red-200',
  security: 'bg-red-100 text-red-700 border-red-200',
  performance: 'bg-amber-100 text-amber-700 border-amber-200',
  database: 'bg-purple-100 text-purple-700 border-purple-200',
  'api-change': 'bg-blue-100 text-blue-700 border-blue-200',
  'ui-change': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  dependency: 'bg-orange-100 text-orange-700 border-orange-200',
  testing: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  documentation: 'bg-gray-100 text-gray-700 border-gray-200',
  refactoring: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const priorityConfig: Record<Priority, { color: string; icon: string }> = {
  critical: { color: 'bg-red-100 text-red-700 border-red-200', icon: '!!' },
  high: { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '!' },
  medium: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: '-' },
  low: { color: 'bg-green-100 text-green-700 border-green-200', icon: '~' },
};

export default function SummaryCard(props: SummaryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const { type, data } = props;
  const isPR = type === 'pr';
  const prData = isPR ? (data as PRSummary) : null;
  const issueData = !isPR ? (data as IssueSummary) : null;

  const handleCopy = async () => {
    const text = isPR
      ? `# ${prData!.title}\n\n${prData!.summary}\n\n## Risk Tags\n${prData!.risk_tags.join(', ')}\n\n## Test Checklist\n${prData!.test_checklist.map((t) => `- [ ] ${t}`).join('\n')}`
      : `# ${issueData!.title}\n\n${issueData!.summary}\n\n## Priority: ${issueData!.priority}\n\n## Action Items\n${issueData!.action_items.map((a) => `- [ ] ${a}`).join('\n')}`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`bg-white rounded-xl border-2 transition-all duration-200 ${
        expanded
          ? 'border-blue-300 shadow-lg'
          : 'border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md'
      }`}
    >
      {/* Header - Always visible */}
      <div
        className="p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4">
          {/* Number badge */}
          <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
            isPR ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
          }`}>
            #{data.number}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  data.state === 'open'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-purple-100 text-purple-700'
                }`}
              >
                {data.state}
              </span>
              {!isPR && issueData && (
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full border ${priorityConfig[issueData.priority].color}`}
                >
                  {issueData.priority}
                </span>
              )}
            </div>

            <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">{data.title}</h3>
            <p className="text-sm text-gray-600 line-clamp-2">{data.summary}</p>

            {/* Risk tags for PRs */}
            {isPR && prData && prData.risk_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {prData.risk_tags.map((tag) => (
                  <span key={tag} className={`px-2 py-0.5 text-xs font-medium rounded-full border ${riskTagColors[tag]}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Labels for Issues */}
            {!isPR && issueData && issueData.labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {issueData.labels.map((label) => (
                  <span key={label} className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Expand indicator */}
          <button className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <svg
              className={`w-4 h-4 transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="pt-4">
            {/* Full summary */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Summary</h4>
              <p className="text-sm text-gray-700">{data.summary}</p>
            </div>

            {isPR && prData && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Test Checklist</h4>
                <div className="space-y-2 bg-blue-50 rounded-lg p-3">
                  {prData.test_checklist.map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {!isPR && issueData && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Action Items</h4>
                <div className="space-y-2 bg-green-50 rounded-lg p-3">
                  {issueData.action_items.map((item, idx) => (
                    <label key={idx} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="checkbox" className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                <span className="font-medium">{data.author}</span>
                <span className="mx-1">·</span>
                <span>Updated {new Date(data.updated_at).toLocaleDateString()}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy();
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
                <a
                  href={isPR ? prData!.pr_url : issueData!.issue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
