'use client';

import { useEffect, useState } from 'react';
import { getSchedule } from '@/lib/api';

const platformColors: Record<string, string> = {
  tiktok: 'border-l-pink-500',
  instagram: 'border-l-purple-500',
  twitter: 'border-l-blue-500',
  youtube: 'border-l-red-500',
};

const statusBadge: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  publishing: 'bg-blue-500/20 text-blue-400',
  published: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
};

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSchedule()
      .then(setSchedule)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400">Loading schedule...</div>;

  const grouped = schedule.reduce<Record<string, any[]>>((acc, item) => {
    const date = new Date(item.scheduled_posts.scheduledFor).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    (acc[date] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Post Schedule</h1>

      {Object.keys(grouped).length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500">No scheduled posts. Content generation runs daily at 2 AM.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, posts]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wide">{date}</h2>
              <div className="space-y-3">
                {posts.map((item: any) => (
                  <div
                    key={item.scheduled_posts.id}
                    className={`bg-gray-900 border border-gray-800 border-l-4 ${platformColors[item.scheduled_posts.platform] || ''} rounded-xl p-4`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium capitalize">{item.scheduled_posts.platform}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadge[item.scheduled_posts.status]}`}>
                          {item.scheduled_posts.status}
                        </span>
                      </div>
                      <span className="text-sm text-gray-400">
                        {new Date(item.scheduled_posts.scheduledFor).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2">{item.content_queue.caption}</p>
                    {item.scheduled_posts.errorMessage && (
                      <p className="text-xs text-red-400 mt-2">{item.scheduled_posts.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
