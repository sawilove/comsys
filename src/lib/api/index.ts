import { isConfigured } from './config';
import { DemoBackend } from './demo';
import { SupabaseBackend } from './supabase';
import type { Backend } from './types';

export * from './types';
export const api: Backend = isConfigured ? new SupabaseBackend() : new DemoBackend();
