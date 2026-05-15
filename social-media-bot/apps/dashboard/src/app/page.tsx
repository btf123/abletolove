'use client';

import { useEffect, useState } from 'react';
import { getOverview, getTrends } from '@/lib/api';

interface Overview {
  totalFollowers: number;
  totalFollowerChange7d: number;
  postsPublishedToday: number;
  postsScheduled: number;
  repliesSentToday: number;
  platformMetrics: Array<{
    platform: string;
    currentFollowers: number;
    followerChange7d: number;
    avgEngagementRate: number;
  }>;
}

function StatCard({ label, value, change }: { label: string; value: string | number; change?: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      {change !== undefined && (
        <p className={`text-sm mt-1 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {change >= 0 ? '+' : ''}{change.toLocaleString()} this week
        </p>
      )}
    </div>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const colors: Record<string, string> = {
    tiktok: 'bg-pink-500',
    instagram: 'bg-purple-500',
    twitter: 'bg-blue-500',
    youtube: 'bg-red-500',
  };
  return (
    <span className={`inline-block w-3 h-3 rounded-full ${colors[platform] || 'bg-gray-500'} mr-2`} />
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getOverview(), getTrends()])
      .then(([ov, tr]) => { setOverview(ov); setTrends(tr); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Followers"
          value={overview?.totalFollowers || 0}
          change={overview?.totalFollowerChange7d}
        />
        <StatCard label="Published Today" value={overview?.postsPublishedToday || 0} />
        <StatCard label="Scheduled" value={overview?.postsScheduled || 0} />
        <StatCard label="Replies Today" value={overview?.repliesSentToday || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Platform Overview</h2>
          {overview?.platformMetrics && overview.platformMetrics.length > 0 ? (
            <div className="space-y-3">
              {overview.platformMetrics.map((pm) => (
                <div key={pm.platform} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                  <div className="flex items-center">
                    <PlatformIcon platform={pm.platform} />
                    <span className="capitalize">{pm.platform}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{pm.currentFollowers.toLocaleString()}</span>
                    <span className={`ml-3 text-sm ${pm.followerChange7d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pm.followerChange7d >= 0 ? '+' : ''}{pm.followerChange7d}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No accounts connected yet. Go to Settings to connect your social media accounts.
            </p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Trending Topics</h2>
          {trends.length > 0 ? (
            <div className="space-y-2">
              {trends.slice(0, 8).map((trend) => (
                <div key={trend.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm truncate flex-1">{trend.topic}</span>
                  <span className="text-xs text-gray-500 ml-2">{trend.source.replace('_', ' ')}</span>
                  <span className="text-xs text-purple-400 ml-2 font-mono">
                    {(trend.relevanceScore * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No trends discovered yet. Trend discovery runs every 4 hours.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
