'use client';

import { useEffect, useState } from 'react';
import { getContent, updateContent, deleteContent } from '@/lib/api';

type Status = 'all' | 'draft' | 'approved' | 'scheduled' | 'published' | 'failed';

const statusColors: Record<string, string> = {
  draft: 'bg-yellow-500/20 text-yellow-400',
  approved: 'bg-blue-500/20 text-blue-400',
  scheduled: 'bg-purple-500/20 text-purple-400',
  published: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
};

export default function ContentPage() {
  const [content, setContent] = useState<any[]>([]);
  const [filter, setFilter] = useState<Status>('all');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');

  useEffect(() => {
    loadContent();
  }, [filter]);

  async function loadContent() {
    setLoading(true);
    try {
      const data = await getContent(filter === 'all' ? undefined : filter);
      setContent(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  async function handleApprove(id: string) {
    await updateContent(id, { status: 'approved' });
    loadContent();
  }

  async function handleSaveEdit(id: string) {
    await updateContent(id, { caption: editCaption });
    setEditingId(null);
    loadContent();
  }

  const filters: Status[] = ['all', 'draft', 'approved', 'scheduled', 'published', 'failed'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Content Queue</h1>

      <div className="flex gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
              filter === f
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading content...</p>
      ) : content.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500">No content found. Content is auto-generated daily at 2 AM.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {content.map((item) => (
            <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[item.status]}`}>
                    {item.status}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">{item.contentType}</span>
                  {item.targetPlatforms?.map((p: string) => (
                    <span key={p} className="text-xs text-gray-500 capitalize">{p}</span>
                  ))}
                </div>
                <span className="text-xs text-gray-600">
                  {new Date(item.generatedAt).toLocaleDateString()}
                </span>
              </div>

              {editingId === item.id ? (
                <div>
                  <textarea
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 mb-3 min-h-[100px]"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-300 mb-3 whitespace-pre-wrap">{item.caption}</p>
                  {item.hashtags && item.hashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.hashtags.map((tag: string) => (
                        <span key={tag} className="text-xs text-purple-400">#{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {item.status === 'draft' && (
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => { setEditingId(item.id); setEditCaption(item.caption); }}
                      className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => { await deleteContent(item.id); loadContent(); }}
                      className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
