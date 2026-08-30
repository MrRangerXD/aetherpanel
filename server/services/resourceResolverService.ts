import { DatabaseSchema } from '../db';
import { Plan, Server, User } from '../../src/types';

export interface ResourceResolutionInput {
  db: DatabaseSchema;
  user?: User | null;
  planId?: string | null;
  serverCategory?: 'minecraft' | 'bot' | string;
  provisionSource?: 'self_service' | 'admin_assigned' | string;
  customResources?: {
    ramMB?: number;
    cpuCores?: number;
    diskGB?: number;
    backups?: number;
    databases?: number;
  } | null;
  requestedLimits?: {
    memory?: number;
    ramMB?: number;
    cpu?: number;
    cpuCores?: number;
    disk?: number;
    diskGB?: number;
  } | null;
}

export interface ResolvedServerResources {
  ramMB: number;
  cpuCores: number;
  diskGB: number;
  backups: number;
  databases: number;
  memoryMb: number;
  cpuPercent: number;
  diskGb: number;
  planId?: string;
  planName?: string;
  isFreePlan: boolean;
  allocationsLimit: number;
}

export class ResourceResolverError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ResourceResolverError';
    this.code = code;
  }
}

/**
 * AetherPanel Dynamic Plan Resource Authority System
 * Resolves server resource specifications in strict priority order:
 * 1. Admin Custom Server Override (provisionSource === 'admin_assigned')
 * 2. Purchased / Selected Plan Resources (exact plan template specs)
 * 3. Free Plan Default Resources (Bot: 512MB/50%/5GB, Minecraft: 1024MB/100%/10GB)
 */
export function resolveServerResources(input: ResourceResolutionInput): ResolvedServerResources {
  const { db, planId, serverCategory, provisionSource, customResources, requestedLimits } = input;

  // Priority 1: Admin Custom Server Override
  if (provisionSource === 'admin_assigned') {
    const ramMB = Math.max(256, Math.round(customResources?.ramMB || requestedLimits?.ramMB || requestedLimits?.memory || 2048));
    const reqCpu = customResources?.cpuCores || requestedLimits?.cpuCores || (requestedLimits?.cpu !== undefined ? (requestedLimits.cpu > 10 ? requestedLimits.cpu / 100 : requestedLimits.cpu) : 1.0);
    const cpuCores = Math.max(0.1, reqCpu);
    const diskGB = Math.max(1, Math.round(customResources?.diskGB || requestedLimits?.diskGB || requestedLimits?.disk || 10));
    const backups = customResources?.backups ?? 2;
    const databases = customResources?.databases ?? 1;

    return {
      ramMB,
      cpuCores,
      diskGB,
      backups,
      databases,
      memoryMb: ramMB,
      cpuPercent: Math.round(cpuCores * 100),
      diskGb: diskGB,
      isFreePlan: false,
      allocationsLimit: 50
    };
  }

  // Priority 2: Selected / Purchased Plan Resources
  if (planId) {
    const plan = db.plans.find(p => p.id === planId);
    if (!plan) {
      throw new ResourceResolverError('PLAN_NOT_FOUND', 'The selected hosting plan no longer exists.');
    }
    if (plan.isActive === false) {
      throw new ResourceResolverError('PLAN_INACTIVE', 'The selected hosting plan is currently unavailable.');
    }

    // Resolve Category
    const product = db.products.find(p => p.id === plan.productId);
    const planCategory = product?.category || (plan.id.includes('bot') ? 'bot' : 'minecraft');

    if (serverCategory && serverCategory.toLowerCase() !== planCategory.toLowerCase()) {
      throw new ResourceResolverError('PLAN_CATEGORY_MISMATCH', 'This plan is not available for the selected hosting category.');
    }

    const isFreePlan = (plan.priceMonthly === 0 && plan.priceYearly === 0) || plan.id.endsWith('_free') || plan.name.toLowerCase().includes('free');

    if (isFreePlan) {
      if (planCategory === 'bot') {
        const ramMB = 512;
        const cpuCores = 0.5;
        const diskGB = 5;
        return {
          ramMB,
          cpuCores,
          diskGB,
          backups: plan.backupLimit || 1,
          databases: plan.databaseLimit || 1,
          memoryMb: ramMB,
          cpuPercent: 50,
          diskGb: diskGB,
          planId: plan.id,
          planName: plan.name,
          isFreePlan: true,
          allocationsLimit: plan.serverLimit || 1
        };
      } else {
        const ramMB = 1024;
        const cpuCores = 1.0;
        const diskGB = 10;
        return {
          ramMB,
          cpuCores,
          diskGB,
          backups: plan.backupLimit || 1,
          databases: plan.databaseLimit || 1,
          memoryMb: ramMB,
          cpuPercent: 100,
          diskGb: diskGB,
          planId: plan.id,
          planName: plan.name,
          isFreePlan: true,
          allocationsLimit: plan.serverLimit || 1
        };
      }
    }

    // Paid or Credit-purchased Plan - EXACT PLAN RESOURCES!
    const ramMB = Math.max(256, Number(plan.ramMB) || 1024);
    const cpuCores = Math.max(0.1, Number(plan.cpuCores) || 1.0);
    const diskGB = Math.max(1, Number(plan.diskGB) || 10);
    const backups = Math.max(0, Number(plan.backupLimit) || 2);
    const databases = Math.max(0, Number(plan.databaseLimit) || 1);
    const allocationsLimit = Math.max(1, Number(plan.serverLimit) || 1);

    return {
      ramMB,
      cpuCores,
      diskGB,
      backups,
      databases,
      memoryMb: ramMB,
      cpuPercent: Math.round(cpuCores * 100),
      diskGb: diskGB,
      planId: plan.id,
      planName: plan.name,
      isFreePlan: false,
      allocationsLimit
    };
  }

  // Priority 3: Free Plan Default Fallback (no planId provided)
  const category = (serverCategory || 'minecraft').toLowerCase();
  if (category === 'bot') {
    return {
      ramMB: 512,
      cpuCores: 0.5,
      diskGB: 5,
      backups: 1,
      databases: 1,
      memoryMb: 512,
      cpuPercent: 50,
      diskGb: 5,
      isFreePlan: true,
      allocationsLimit: 1
    };
  }

  return {
    ramMB: 1024,
    cpuCores: 1.0,
    diskGB: 10,
    backups: 1,
    databases: 1,
    memoryMb: 1024,
    cpuPercent: 100,
    diskGb: 10,
    isFreePlan: true,
    allocationsLimit: 1
  };
}
