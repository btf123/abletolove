'use client';

import { useEffect, useState } from 'react';
import { getEngagement } from '@/lib/api';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  sent: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  flagged: 'bg-orange-500/20 text-orange-400',
};

export default function EngagementPage() {
  const [replies, setReplies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEngagement()
      .then(setReplies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading engagement data...</div>;

  const stats = {
    total: replies.length,
    sent: replies.filter((r) => r.replyStatus === 'sent').length,
    flagged: replies.filter((r) => r.replyStatus === 'flagged').length,
    failed: replies.filter((r) => r.replyStatus === 'failed').length,
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Engagement</h1>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-sm text-gray-400">Total Replies</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{stats.sent}</p>
          <p className="text-sm text-gray-400">Sent</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{stats.flagged}</p>
          <p className="text-sm text-gray-400">Flagged</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
          <p className="text-sm text-gray-400">Failed</p>
        </div>
      </div>

      {replies.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500">No engagement activity yet. Auto-replies run every 30 minutes on published posts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {replies.map((reply) => (
            <div key={reply.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-500 capitalize">{reply.platform}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[reply.replyStatus]}`}>
                  {reply.replyStatus}
                </span>
                {reply.repliedAt && (
                  <span className="text-xs text-gray-600">
                    {new Date(reply.repliedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="bg-gray-800 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-500 mb-1">Comment:</p>
                <p className="text-sm text-gray-300">{reply.commentText}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Auto-reply:</p>
                <p className="text-sm text-gray-200">{reply.replyText}</p>
              </div>
              {reply.flaggedReason && (
                <p className="text-xs text-orange-400 mt-2">Flagged: {reply.flaggedReason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
