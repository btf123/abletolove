'use client';

import { useEffect, useState } from 'react';
import {
  getOverview,
  getTrends,
  getStatus,
  triggerTrends,
  triggerContent,
  triggerEngagement,
  triggerAnalytics,
  triggerTokenRefresh,
} from '@/lib/api';

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

interface SystemStatus {
  platforms: string[];
  connectedAccounts: number;
  pendingPosts: number;
  publishedPosts: number;
  draftContent: number;
  activeTrends: number;
  repliesSent: number;
  repliesFlagged: number;
  openaiConfigured: boolean;
}

function StatCard({ label, value, change, color }: { label: string; value: string | number; change?: number; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color || ''}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
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

interface TriggerButtonProps {
  label: string;
  description: string;
  action: () => Promise<any>;
}

function TriggerButton({ label, description, action }: TriggerButtonProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleClick() {
    setRunning(true);
    setResult(null);
    try {
      const res = await action();
      setResult(JSON.stringify(res, null, 0).slice(0, 80));
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    }
    setRunning(false);
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
        {result && (
          <p className="text-xs text-green-400 mt-1 font-mono">{result}</p>
        )}
      </div>
      <button
        onClick={handleClick}
        disabled={running}
        className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
      >
        {running ? 'Running...' : 'Run Now'}
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getOverview(), getTrends(), getStatus()])
      .then(([ov, tr, st]) => { setOverview(ov); setTrends(tr); setStatus(st); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-gray-400">Loading dashboard...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* System alerts */}
      {status && !status.openaiConfigured && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6 text-sm text-yellow-400">
          OpenAI API key is not configured. Content generation and auto-replies will not work.
          Add OPENAI_API_KEY to your .env file.
        </div>
      )}
      {status && status.connectedAccounts === 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6 text-sm text-blue-400">
          No social media accounts connected. <a href="/setup" className="underline font-medium">Run the setup wizard</a> to get started.
        </div>
      )}

      {/* Main stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          label="Total Followers"
          value={overview?.totalFollowers || 0}
          change={overview?.totalFollowerChange7d}
        />
        <StatCard label="Published Today" value={overview?.postsPublishedToday || 0} />
        <StatCard label="Scheduled" value={status?.pendingPosts || 0} />
        <StatCard label="Active Trends" value={status?.activeTrends || 0} color="text-purple-400" />
        <StatCard label="Auto-Replies" value={status?.repliesSent || 0} color="text-green-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Platform overview */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Platforms</h2>
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
              No accounts connected. <a href="/setup" className="text-purple-400 underline">Set up now</a>
            </p>
          )}
          {status && (
            <div className="mt-4 pt-3 border-t border-gray-800 text-xs text-gray-500">
              <p>{status.connectedAccounts} account(s) connected</p>
              <p>{status.publishedPosts} total posts published</p>
              {status.repliesFlagged > 0 && (
                <p className="text-orange-400">{status.repliesFlagged} replies flagged for review</p>
              )}
            </div>
          )}
        </div>

        {/* Trending topics */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Trending Topics</h2>
          {trends.length > 0 ? (
            <div className="space-y-2">
              {trends.slice(0, 10).map((trend) => (
                <div key={trend.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm truncate flex-1 mr-2">{trend.topic}</span>
                  <span className="text-xs text-purple-400 font-mono whitespace-nowrap">
                    {(trend.relevanceScore * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              No trends yet. Click "Run Now" on Discover Trends or wait for the next cycle.
            </p>
          )}
        </div>

        {/* Manual triggers */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold mb-4">Manual Controls</h2>
          <TriggerButton
            label="Discover Trends"
            description="Scan all sources for trending topics"
            action={triggerTrends}
          />
          <TriggerButton
            label="Generate Content"
            description="Create posts from top trends via AI"
            action={triggerContent}
          />
          <TriggerButton
            label="Process Comments"
            description="Fetch & reply to new comments"
            action={triggerEngagement}
          />
          <TriggerButton
            label="Collect Analytics"
            description="Pull latest metrics from platforms"
            action={triggerAnalytics}
          />
          <TriggerButton
            label="Refresh Tokens"
            description="Renew OAuth tokens for all accounts"
            action={triggerTokenRefresh}
          />
        </div>
      </div>
    </div>
  );
}
