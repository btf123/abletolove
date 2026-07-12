import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { db } from '../db/client.js';
import { systemConfig } from '../db/schema.js';
import { seedCampaign } from '../pipelines/campaign/seeder.js';

// One-command campaign setup:
//   npm run setup:abletolove -w apps/engine
// Loads the Able To Love niche config into system_config and seeds the
// 30-day launch campaign as drafts awaiting approval in the dashboard.

async function setConfig(key: string, value: any): Promise<void> {
  await db.insert(systemConfig)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: systemConfig.key, set: { value, updatedAt: new Date() } });
}

async function main() {
  const nichePath = process.env.NICHE_FILE
    || path.resolve(process.cwd(), '../../config/abletolove.niche.json');
  const niche = JSON.parse(await readFile(nichePath, 'utf8'));

  console.log('[Setup] Loading Able To Love niche config...');

  await setConfig('niche_keywords', niche.niche_keywords);
  await setConfig('content_tone', niche.content_tone);
  await setConfig('posts_per_day', niche.posts_per_day);
  await setConfig('auto_approve_content', niche.auto_approve_content);
  await setConfig('reply_personality', niche.reply_personality);
  await setConfig('brand_banned_language', niche.campaign_guardrails?.banned_language || []);

  const guardrails = niche.campaign_guardrails || {};
  const brandRules = [
    `Primary tagline: "${guardrails.primary_tagline || 'You belong here.'}"`,
    `Default call to action: "${guardrails.cta_default || 'Join the waitlist'}"`,
    'Never use pity, inspiration-porn ("overcame", "despite their disability"), or clinical framing.',
    `Never use these words or phrases: ${(guardrails.banned_language || []).join('; ')}.`,
    'Center agency and belonging. Disabled people are the audience, not the subject of the content.',
    'Keep it warm, real, and confident — like a friend who has been there.',
  ].join('\n');
  await setConfig('brand_rules', brandRules);

  await setConfig('campaign_repeat', 'yearly');
  if (!process.env.CAMPAIGN_LINK) {
    console.log('[Setup] Tip: set CAMPAIGN_LINK (or the campaign_link config key) to your live waitlist URL. Using abletolove.app for now.');
  } else {
    await setConfig('campaign_link', process.env.CAMPAIGN_LINK);
  }

  console.log('[Setup] Config saved. Seeding the 30-day launch campaign...');
  const result = await seedCampaign({ force: true });

  console.log('');
  console.log(`[Setup] Done. ${result.seeded} campaign posts are waiting in the dashboard Content queue.`);
  console.log('[Setup] Next steps:');
  console.log('  1. Open the dashboard -> Content -> filter "draft"');
  console.log('  2. Read each post; Approve the ones you like (approval schedules them automatically)');
  console.log('  3. Instagram posts marked with [⚠ attach media] need an image before approving');
  console.log('  4. Nothing ever publishes without your approval.');
  process.exit(0);
}

main().catch((error) => {
  console.error('[Setup] Failed:', error);
  process.exit(1);
});
