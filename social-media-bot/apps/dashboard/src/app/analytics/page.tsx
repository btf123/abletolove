'use client';

import { useEffect, useState } from 'react';
import { getAccounts, getAnalytics } from '@/lib/api';

export default function AnalyticsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccounts()
      .then((accs) => {
        setAccounts(accs);
        if (accs.length > 0) setSelectedAccount(accs[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      getAnalytics(selectedAccount).then(setSnapshots).catch(console.error);
    }
  }, [selectedAccount]);

  if (loading) return <div className="text-gray-400">Loading analytics...</div>;

  if (accounts.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500">No accounts connected. Go to Settings to connect your social media accounts.</p>
        </div>
      </div>
    );
  }

  const latest = snapshots[0];
  const oldest = snapshots[snapshots.length - 1];
  const followerGrowth = latest && oldest ? (latest.followers || 0) - (oldest.followers || 0) : 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      <div className="flex gap-2 mb-6">
        {accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => setSelectedAccount(acc.id)}
            className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
              selectedAccount === acc.id
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {acc.platform} - {acc.accountName}
          </button>
        ))}
      </div>

      {latest && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Followers</p>
            <p className="text-2xl font-bold">{(latest.followers || 0).toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Growth (period)</p>
            <p className={`text-2xl font-bold ${followerGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {followerGrowth >= 0 ? '+' : ''}{followerGrowth.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Total Posts</p>
            <p className="text-2xl font-bold">{(latest.totalPosts || 0).toLocaleString()}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-1">Engagement Rate</p>
            <p className="text-2xl font-bold">
              {((latest.engagementRate || 0) * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Follower History</h2>
        {snapshots.length > 0 ? (
          <div className="space-y-1">
            {snapshots.slice(0, 30).map((snap) => (
              <div key={snap.id} className="flex items-center justify-between py-1 border-b border-gray-800 last:border-0">
                <span className="text-sm text-gray-400">{snap.snapshotDate}</span>
                <span className="text-sm font-medium">{(snap.followers || 0).toLocaleString()} followers</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No analytics data yet. Data is collected every 6 hours.</p>
        )}
      </div>
    </div>
  );
}
