import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const trendsQueue = new Queue('trends', { connection });
export const contentQueue = new Queue('content', { connection });
export const publishingQueue = new Queue('publishing', { connection });
export const engagementQueue = new Queue('engagement', { connection });
export const analyticsQueue = new Queue('analytics', { connection });
