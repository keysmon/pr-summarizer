'use client';

import { useState, useEffect } from 'react';

interface RepoSelectorProps {
  onRepoSelect: (owner: string, repo: string) => void;
  disabled?: boolean;
}

export default function RepoSelector({ onRepoSelect, disabled }: RepoSelectorProps) {
  const [repoInput, setRepoInput] = useState('');
  const [recentRepos, setRecentRepos] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('recent_repos');
    if (saved) {
      setRecentRepos(JSON.parse(saved));
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = repoInput.trim();

    if (!trimmed.includes('/')) {
      setError('Please enter in format: owner/repo');
      return;
    }

    const [owner, repo] = trimmed.split('/');
    if (!owner || !repo) {
      setError('Please enter in format: owner/repo');
      return;
    }

    setError('');

    // Save to recent repos
    const newRecent = [trimmed, ...recentRepos.filter((r) => r !== trimmed)].slice(0, 5);
    setRecentRepos(newRecent);
    localStorage.setItem('recent_repos', JSON.stringify(newRecent));

    onRepoSelect(owner, repo);
  };

  const handleRecentSelect = (fullRepo: string) => {
    setRepoInput(fullRepo);
    const [owner, repo] = fullRepo.split('/');
    onRepoSelect(owner, repo);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">Repository</label>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={repoInput}
          onChange={(e) => {
            setRepoInput(e.target.value);
            setError('');
          }}
          placeholder="owner/repo (e.g., facebook/react)"
          disabled={disabled}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={disabled || !repoInput.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Fetch
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {recentRepos.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1">Recent:</p>
          <div className="flex flex-wrap gap-2">
            {recentRepos.map((repo) => (
              <button
                key={repo}
                onClick={() => handleRecentSelect(repo)}
                disabled={disabled}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                {repo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
