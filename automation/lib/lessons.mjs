// Voice lessons: the file the robots read before writing anything, and that
// learn-voice.mjs updates from the founder's dashboard feedback. This is how
// the account's personality learns as it posts.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LESSONS_FILE = path.join(ROOT, 'social-media-bot/config/voice-lessons.md');

// Returns the lesson bullet lines (without the header prose), or [].
export async function loadLessons() {
  try {
    const text = await readFile(LESSONS_FILE, 'utf8');
    const afterHeading = text.split(/##\s*Lessons/i)[1] || '';
    return afterHeading
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

// A prompt block to append to any generator prompt. Empty string if no lessons.
export async function lessonsPromptBlock() {
  const lessons = await loadLessons();
  if (!lessons.length) return '';
  return `\n\nLESSONS FROM THE FOUNDER'S FEEDBACK (obey these; they override style defaults, newest first):\n${lessons.map((l) => `- ${l}`).join('\n')}`;
}
