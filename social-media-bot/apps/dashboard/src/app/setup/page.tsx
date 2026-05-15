'use client';

import { useState, useEffect } from 'react';
import { addAccount, setConfig, getAccounts } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const PLATFORMS = [
  {
    id: 'twitter',
    name: 'Twitter / X',
    color: 'bg-blue-500',
    fields: [
      { key: 'username', label: 'Username', placeholder: '@yourhandle' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'OAuth 2.0 access token' },
      { key: 'refreshToken', label: 'Refresh Token', placeholder: 'OAuth 2.0 refresh token' },
    ],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    color: 'bg-pink-500',
    fields: [
      { key: 'username', label: 'Username', placeholder: '@yourhandle' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'TikTok OAuth access token' },
      { key: 'refreshToken', label: 'Refresh Token', placeholder: 'TikTok OAuth refresh token' },
      { key: 'openId', label: 'Open ID', placeholder: 'Your TikTok open_id' },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    color: 'bg-purple-500',
    fields: [
      { key: 'username', label: 'Username', placeholder: '@yourhandle' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Long-lived access token' },
      { key: 'userId', label: 'User ID', placeholder: 'Instagram Business account user ID' },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    color: 'bg-red-500',
    fields: [
      { key: 'channelName', label: 'Channel Name', placeholder: 'Your channel name' },
      { key: 'accessToken', label: 'Access Token', placeholder: 'Google OAuth access token' },
      { key: 'refreshToken', label: 'Refresh Token', placeholder: 'Google OAuth refresh token' },
      { key: 'channelId', label: 'Channel ID', placeholder: 'UC...' },
    ],
  },
];

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>({});
  const [oauthUrls, setOauthUrls] = useState<Record<string, string | null>>({});
  const [niche, setNiche] = useState('social media growth tips, content creation, followers, engagement, algorithm');
  const [tone, setTone] = useState('friendly, helpful, and expert');
  const [postsPerDay, setPostsPerDay] = useState('2');
  const [error, setError] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    // Check URL params for OAuth callback results
    const params = new URLSearchParams(window.location.search);
    const connectedPlatform = params.get('connected');
    const oauthError = params.get('error');
    if (connectedPlatform) setConnected((prev) => new Set([...prev, connectedPlatform]));
    if (oauthError) setError(oauthError);

    // Fetch existing accounts and OAuth URLs
    getAccounts().then((accs) => {
      const alreadyConnected = new Set(accs.map((a: any) => a.platform));
      setConnected(alreadyConnected);
    }).catch(() => {});

    fetch(`${API_BASE}/api/oauth/urls`)
      .then((r) => r.json())
      .then((data: any[]) => {
        const urls: Record<string, string | null> = {};
        data.forEach((d) => { urls[d.platform] = d.url; });
        setOauthUrls(urls);
      })
      .catch(() => {});
  }, []);

  function updateCredential(platform: string, key: string, value: string) {
    setCredentials((prev) => ({
      ...prev,
      [platform]: { ...(prev[platform] || {}), [key]: value },
    }));
  }

  async function handleConnect(platformId: string) {
    const creds = credentials[platformId];
    if (!creds) return;
    setConnecting(platformId);
    setError('');
    try {
      await addAccount(platformId, creds.username || creds.channelName || platformId, creds);
      setConnected((prev) => new Set([...prev, platformId]));
    } catch (e: any) {
      setError(`Failed to connect ${platformId}: ${e.message}`);
    }
    setConnecting(null);
  }

  async function handleFinishSetup() {
    try {
      await Promise.all([
        setConfig('niche_keywords', niche.split(',').map((k) => k.trim()).filter(Boolean)),
        setConfig('content_tone', tone),
        setConfig('posts_per_day', parseInt(postsPerDay) || 2),
        setConfig('auto_approve_content', true),
        setConfig('reply_personality', 'friendly, helpful, and knowledgeable about social media growth'),
      ]);
      setSetupComplete(true);
    } catch (e: any) {
      setError(`Failed to save config: ${e.message}`);
    }
  }

  if (setupComplete) {
    return (
      <div className="max-w-xl mx-auto mt-20 text-center">
        <div className="text-5xl mb-4">&#10003;</div>
        <h1 className="text-2xl font-bold mb-2">Setup Complete!</h1>
        <p className="text-gray-400 mb-6">
          Your social media bot is now running. Here's what happens next:
        </p>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-left space-y-3 text-sm text-gray-300">
          <p>1. Trending topics will be discovered every 4 hours</p>
          <p>2. Content will be auto-generated daily at 2:00 AM</p>
          <p>3. Posts will be published at optimal times throughout the day</p>
          <p>4. Comments will be auto-responded to every 30 minutes</p>
          <p>5. Analytics will be tracked every 6 hours</p>
        </div>
        <a href="/" className="inline-block mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          Go to Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Setup Wizard</h1>
      <p className="text-gray-400 mb-8">Connect your accounts and configure your growth bot.</p>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 text-sm text-red-400">
          {error}
        </div>
      )}

      {step === 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Step 1: Connect Platforms</h2>
          <p className="text-sm text-gray-400 mb-6">
            Connect at least one social media platform. You'll need OAuth tokens from each platform's developer portal.
          </p>
          <div className="space-y-6">
            {PLATFORMS.map((platform) => (
              <div key={platform.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${platform.color}`} />
                    <span className="font-medium">{platform.name}</span>
                  </div>
                  {connected.has(platform.id) && (
                    <span className="text-xs text-green-400 font-medium">Connected</span>
                  )}
                </div>
                {!connected.has(platform.id) && (
                  <div className="space-y-3">
                    {oauthUrls[platform.id] && (
                      <div className="mb-3">
                        <a
                          href={oauthUrls[platform.id]!}
                          className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
                        >
                          Connect with OAuth (Recommended)
                        </a>
                        <p className="text-xs text-gray-500 mt-2">Or enter tokens manually below:</p>
                      </div>
                    )}
                    {platform.fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs text-gray-400 mb-1">{field.label}</label>
                        <input
                          type={field.key.includes('Token') || field.key.includes('Secret') ? 'password' : 'text'}
                          placeholder={field.placeholder}
                          value={credentials[platform.id]?.[field.key] || ''}
                          onChange={(e) => updateCredential(platform.id, field.key, e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-gray-200"
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => handleConnect(platform.id)}
                      disabled={connecting === platform.id}
                      className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                    >
                      {connecting === platform.id ? 'Connecting...' : 'Connect'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setStep(1)}
            disabled={connected.size === 0}
            className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next: Configure Content
          </button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Step 2: Configure Your Niche</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Niche Keywords</label>
              <textarea
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-gray-200"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated. These filter trending topics for relevance to your content.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Content Tone</label>
              <input
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm text-gray-200"
              />
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
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setStep(0)}
              className="px-6 py-2 bg-gray-700 text-gray-300 rounded-lg font-medium hover:bg-gray-600"
            >
              Back
            </button>
            <button
              onClick={handleFinishSetup}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
            >
              Finish Setup &amp; Start Bot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
