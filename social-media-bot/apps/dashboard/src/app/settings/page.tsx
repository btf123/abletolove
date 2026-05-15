'use client';

import { useEffect, useState } from 'react';
import { getAccounts, getConfig, setConfig, addAccount, updateAccount, deleteAccount } from '@/lib/api';

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [config, setConfigState] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nicheKeywords, setNicheKeywords] = useState('');
  const [postsPerDay, setPostsPerDay] = useState('2');
  const [contentTone, setContentTone] = useState('');
  const [autoApprove, setAutoApprove] = useState(true);
  const [replyPersonality, setReplyPersonality] = useState('');

  useEffect(() => {
    Promise.all([getAccounts(), getConfig()])
      .then(([accs, configs]) => {
        setAccounts(accs);
        const configMap = Object.fromEntries(configs.map((c: any) => [c.key, c.value]));
        setConfigState(configMap);
        setNicheKeywords(Array.isArray(configMap.niche_keywords) ? configMap.niche_keywords.join(', ') : 'social media, tiktok, instagram, youtube, content creator, followers, engagement');
        setPostsPerDay(String(configMap.posts_per_day || 2));
        setContentTone(configMap.content_tone || 'friendly, helpful, and expert');
        setAutoApprove(configMap.auto_approve_content ?? true);
        setReplyPersonality(configMap.reply_personality || 'friendly, helpful, and knowledgeable about social media growth');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all([
        setConfig('niche_keywords', nicheKeywords.split(',').map((k) => k.trim()).filter(Boolean)),
        setConfig('posts_per_day', parseInt(postsPerDay) || 2),
        setConfig('content_tone', contentTone),
        setConfig('auto_approve_content', autoApprove),
        setConfig('reply_personality', replyPersonality),
      ]);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  if (loading) return <div className="text-gray-400">Loading settings...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Connected Accounts</h2>
        {accounts.length > 0 ? (
          <div className="space-y-3">
            {accounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <span className="capitalize font-medium">{acc.platform}</span>
                  <span className="text-gray-400 ml-2">@{acc.accountName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await updateAccount(acc.id, { isActive: !acc.isActive });
                      const accs = await getAccounts();
                      setAccounts(accs);
                    }}
                    className={`text-xs px-2 py-1 rounded ${acc.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}
                  >
                    {acc.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Remove ${acc.platform} account @${acc.accountName}?`)) {
                        await deleteAccount(acc.id);
                        const accs = await getAccounts();
                        setAccounts(accs);
                      }
                    }}
                    className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm mb-4">
            No accounts connected. Use the API to connect accounts with OAuth tokens.
          </p>
        )}
        <p className="text-xs text-gray-600 mt-3">
          To connect accounts, use the engine API: POST /api/accounts with platform, accountName, and OAuth credentials.
        </p>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Content Settings</h2>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Niche Keywords</label>
            <textarea
              value={nicheKeywords}
              onChange={(e) => setNicheKeywords(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200"
              rows={3}
              placeholder="social media, growth, followers, engagement"
            />
            <p className="text-xs text-gray-500 mt-1">Comma-separated keywords used to filter trending topics for relevance.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Posts Per Day (per platform)</label>
            <input
              type="number"
              value={postsPerDay}
              onChange={(e) => setPostsPerDay(e.target.value)}
              className="w-24 bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-gray-200"
              min="1"
              max="10"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Content Tone</label>
            <input
              type="text"
              value={contentTone}
              onChange={(e) => setContentTone(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-gray-200"
              placeholder="friendly, helpful, and expert"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Reply Personality</label>
            <input
              type="text"
              value={replyPersonality}
              onChange={(e) => setReplyPersonality(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-gray-200"
              placeholder="friendly, helpful, and knowledgeable"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="autoApprove"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="w-4 h-4 rounded border-gray-700"
            />
            <label htmlFor="autoApprove" className="text-sm text-gray-300">
              Auto-approve generated content (skip manual review)
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Automation Schedule</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1.5 border-b border-gray-800">
            <span className="text-gray-400">Trend Discovery</span>
            <span>Every 4 hours</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-800">
            <span className="text-gray-400">Content Generation</span>
            <span>Daily at 2:00 AM</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-800">
            <span className="text-gray-400">Post Publishing</span>
            <span>Every 15 minutes</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-800">
            <span className="text-gray-400">Comment Responses</span>
            <span>Every 30 minutes</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-gray-800">
            <span className="text-gray-400">Analytics Collection</span>
            <span>Every 6 hours</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-gray-400">Token Refresh</span>
            <span>Daily at midnight</span>
          </div>
        </div>
      </section>
    </div>
  );
}
