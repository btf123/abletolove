import { db } from '../../db/client.js';
import { systemConfig } from '../../db/schema.js';

// Language that must never appear in generated content, regardless of what
// the model produces. Configurable via the brand_banned_language config key;
// these defaults apply when the key is unset.
const DEFAULT_BANNED_LANGUAGE = [
  'suffers from',
  'afflicted',
  'confined to a wheelchair',
  'wheelchair-bound',
  'special needs',
  'differently abled',
  'handicapable',
  'overcame',
  'despite her disability',
  'despite his disability',
  'despite their disability',
  'inspiring us all',
];

export async function getBannedLanguage(): Promise<string[]> {
  try {
    const configs = await db.select().from(systemConfig);
    const configMap = Object.fromEntries(configs.map((c) => [c.key, c.value]));
    const configured = configMap.brand_banned_language;
    if (Array.isArray(configured) && configured.length > 0) {
      return configured.map((p) => String(p));
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_BANNED_LANGUAGE;
}

export function findGuardrailViolation(text: string, bannedLanguage: string[]): string | null {
  const haystack = text.toLowerCase();
  for (const phrase of bannedLanguage) {
    if (haystack.includes(phrase.toLowerCase())) {
      return phrase;
    }
  }
  return null;
}
