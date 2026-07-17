#!/usr/bin/env node
/**
 * Release the newest post batch for publishing (the weekly veto's "yes").
 *
 * New batches are written with approved:false so nothing goes out until you've
 * had a chance to read them and bin or edit any day. This flips the newest
 * batch's week.json to approved:true. After this, the daily publisher starts
 * posting that week's days on schedule.
 *
 * To VETO instead of approve: just don't run this, or set "hold": true on a
 * specific day (or delete a day) in the week.json before approving.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUEUE = path.join(ROOT, 'content-queue');

const dirs = (await readdir(QUEUE, { withFileTypes: true }))
  .filter((d) => d.isDirectory() && /^week-\d{4}-\d{2}-\d{2}$/.test(d.name))
  .map((d) => d.name).sort();
if (!dirs.length) { console.log('No dated week batches found.'); process.exit(0); }

const weekDir = dirs[dirs.length - 1];
const file = path.join(QUEUE, weekDir, 'week.json');
const week = JSON.parse(await readFile(file, 'utf8'));

if (week.approved === true) { console.log(`${weekDir} is already approved. Nothing to do.`); process.exit(0); }

week.approved = true;
await writeFile(file, JSON.stringify(week, null, 2));
const live = (week.days || []).filter((d) => !d.hold).length;
console.log(`Approved ${weekDir}: ${live} day(s) released for posting (${(week.days || []).length - live} held).`);
