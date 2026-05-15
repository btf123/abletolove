import type { PlatformType } from '@smbot/shared';
import type { BasePlatform } from './base.js';

const platformRegistry = new Map<PlatformType, BasePlatform>();

export function registerPlatform(adapter: BasePlatform): void {
  platformRegistry.set(adapter.name, adapter);
}

export function getPlatform(name: PlatformType): BasePlatform {
  const platform = platformRegistry.get(name);
  if (!platform) throw new Error(`Platform "${name}" is not registered`);
  return platform;
}

export function getAllPlatforms(): BasePlatform[] {
  return Array.from(platformRegistry.values());
}

export function getRegisteredPlatformNames(): PlatformType[] {
  return Array.from(platformRegistry.keys());
}
