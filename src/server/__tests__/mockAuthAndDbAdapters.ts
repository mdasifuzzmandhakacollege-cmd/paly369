/**
 * @file mockAuthAndDbAdapters.ts
 * @description Hermetic in-memory Firebase Admin Auth & Firestore adapters for CI test environments.
 * Guarantees zero network calls, zero GCP ADC dependency, and deterministic verification.
 */

import {
  AdminAuthAdapter,
  AdminDbAdapter,
  AdminDbDocRef,
  AdminDbDocSnapshot,
  setAdminAuthAdapter,
  setAdminDbAdapter,
  resetAdminAdapters
} from '../../lib/firebase-admin.js';
import type { DecodedIdToken } from 'firebase-admin/auth';

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export class InMemoryAuthAdapter implements AdminAuthAdapter {
  private users: Map<string, DecodedIdToken> = new Map();
  private tokenMap: Map<string, DecodedIdToken> = new Map();
  private customResolver: ((token: string) => Promise<DecodedIdToken> | DecodedIdToken) | null = null;

  constructor() {
    this.seedDefaults();
  }

  public seedDefaults() {
    const defaultUsers: DecodedIdToken[] = [
      {
        uid: 'user_admin_999',
        email: 'admin@play369.com',
        role: 'ADMIN',
        isAdmin: true,
        admin: true,
        aud: 'play369-test',
        auth_time: 1700000000,
        exp: 2000000000,
        iat: 1700000000,
        iss: 'https://securetoken.google.com/play369-test',
        sub: 'user_admin_999',
        firebase: { identities: {}, sign_in_provider: 'custom' }
      } as any,
      {
        uid: 'user_operator_999',
        email: 'operator@play369.com',
        role: 'OPERATOR',
        isAdmin: true,
        aud: 'play369-test',
        auth_time: 1700000000,
        exp: 2000000000,
        iat: 1700000000,
        iss: 'https://securetoken.google.com/play369-test',
        sub: 'user_operator_999',
        firebase: { identities: {}, sign_in_provider: 'custom' }
      } as any,
      {
        uid: 'user_super_admin_999',
        email: 'superadmin@play369.com',
        role: 'SUPER_ADMIN',
        isAdmin: true,
        aud: 'play369-test',
        auth_time: 1700000000,
        exp: 2000000000,
        iat: 1700000000,
        iss: 'https://securetoken.google.com/play369-test',
        sub: 'user_super_admin_999',
        firebase: { identities: {}, sign_in_provider: 'custom' }
      } as any,
      {
        uid: 'user_player_123',
        email: 'player@play369.com',
        role: 'PLAYER',
        isAdmin: false,
        aud: 'play369-test',
        auth_time: 1700000000,
        exp: 2000000000,
        iat: 1700000000,
        iss: 'https://securetoken.google.com/play369-test',
        sub: 'user_player_123',
        firebase: { identities: {}, sign_in_provider: 'custom' }
      } as any,
      {
        uid: 'user_vip_123',
        email: 'vip@play369.com',
        role: 'VIP',
        isAdmin: false,
        aud: 'play369-test',
        auth_time: 1700000000,
        exp: 2000000000,
        iat: 1700000000,
        iss: 'https://securetoken.google.com/play369-test',
        sub: 'user_vip_123',
        firebase: { identities: {}, sign_in_provider: 'custom' }
      } as any
    ];

    for (const u of defaultUsers) {
      this.users.set(u.uid, u);
    }

    this.tokenMap.set('mock_admin_token', this.users.get('user_admin_999')!);
    this.tokenMap.set('valid_admin_token', this.users.get('user_admin_999')!);
    this.tokenMap.set('mock_ADMIN_token', this.users.get('user_admin_999')!);
    this.tokenMap.set('mock_operator_token', this.users.get('user_operator_999')!);
    this.tokenMap.set('valid_operator_token', this.users.get('user_operator_999')!);
    this.tokenMap.set('mock_OPERATOR_token', this.users.get('user_operator_999')!);
    this.tokenMap.set('mock_super_admin_token', this.users.get('user_super_admin_999')!);
    this.tokenMap.set('mock_SUPER_ADMIN_token', this.users.get('user_super_admin_999')!);
    this.tokenMap.set('mock_player_token', this.users.get('user_player_123')!);
    this.tokenMap.set('valid_player_token', this.users.get('user_player_123')!);
    this.tokenMap.set('valid_mock_token', this.users.get('user_player_123')!);
    this.tokenMap.set('mock_vip_token', this.users.get('user_vip_123')!);
    this.tokenMap.set('mock_VIP_token', this.users.get('user_vip_123')!);
  }

  public registerToken(token: string, payload: Partial<DecodedIdToken>): void {
    const fullPayload: DecodedIdToken = {
      uid: payload.uid || `user_${Date.now()}`,
      aud: 'play369-test',
      auth_time: 1700000000,
      exp: 2000000000,
      iat: 1700000000,
      iss: 'https://securetoken.google.com/play369-test',
      sub: payload.uid || `user_${Date.now()}`,
      firebase: { identities: {}, sign_in_provider: 'custom' },
      ...payload
    } as any;
    this.tokenMap.set(token, fullPayload);
  }

  public setTokenResolver(resolver: ((token: string) => Promise<DecodedIdToken> | DecodedIdToken) | null): void {
    this.customResolver = resolver;
  }

  public async verifyIdToken(token: string, _checkRevoked?: boolean): Promise<DecodedIdToken> {
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new Error('Unauthorized: Missing or empty token');
    }

    if (this.customResolver) {
      return await this.customResolver(token);
    }

    if (this.tokenMap.has(token)) {
      return this.tokenMap.get(token)!;
    }

    const lower = token.toLowerCase();

    // Check for explicit invalid token formats
    if (
      lower.includes('invalid') ||
      lower.includes('malformed') ||
      lower.includes('expired') ||
      lower.includes('corrupted') ||
      lower === 'bad_token' ||
      lower === 'xyz123' ||
      lower === 'abc'
    ) {
      throw new Error('Decoding Firebase ID token failed: Invalid token signature or format');
    }

    if (lower.includes('admin') || lower.includes('operator') || lower.includes('super_admin')) {
      const role = lower.includes('super') ? 'SUPER_ADMIN' : lower.includes('operator') ? 'OPERATOR' : 'ADMIN';
      return {
        uid: `user_${role.toLowerCase()}_${Math.abs(hashString(token))}`,
        email: `${role.toLowerCase()}@play369.com`,
        role,
        isAdmin: true,
        admin: true,
        aud: 'play369-test',
        auth_time: 1700000000,
        exp: 2000000000,
        iat: 1700000000,
        iss: 'https://securetoken.google.com/play369-test',
        sub: `user_${role.toLowerCase()}`,
        firebase: { identities: {}, sign_in_provider: 'custom' }
      } as any;
    }

    if (lower.includes('player') || lower.includes('valid') || lower.includes('test_user') || lower.includes('user_')) {
      return {
        uid: `user_player_${Math.abs(hashString(token))}`,
        email: 'player@play369.com',
        role: 'PLAYER',
        isAdmin: false,
        aud: 'play369-test',
        auth_time: 1700000000,
        exp: 2000000000,
        iat: 1700000000,
        iss: 'https://securetoken.google.com/play369-test',
        sub: `user_player`,
        firebase: { identities: {}, sign_in_provider: 'custom' }
      } as any;
    }

    if (lower.includes('vip')) {
      return {
        uid: `user_vip_${Math.abs(hashString(token))}`,
        email: 'vip@play369.com',
        role: 'VIP',
        isAdmin: false,
        aud: 'play369-test',
        auth_time: 1700000000,
        exp: 2000000000,
        iat: 1700000000,
        iss: 'https://securetoken.google.com/play369-test',
        sub: `user_vip`,
        firebase: { identities: {}, sign_in_provider: 'custom' }
      } as any;
    }

    return {
      uid: `user_${Math.abs(hashString(token))}`,
      email: 'user@play369.com',
      role: 'PLAYER',
      isAdmin: false,
      aud: 'play369-test',
      auth_time: 1700000000,
      exp: 2000000000,
      iat: 1700000000,
      iss: 'https://securetoken.google.com/play369-test',
      sub: 'user',
      firebase: { identities: {}, sign_in_provider: 'custom' }
    } as any;
  }

  public async getUser(uid: string): Promise<any> {
    const user = this.users.get(uid);
    if (!user) {
      throw new Error(`User record with uid ${uid} not found`);
    }
    return user;
  }
}

export class InMemoryDbAdapter implements AdminDbAdapter {
  private collections: Map<string, Map<string, Record<string, any>>> = new Map();

  constructor() {
    this.seedDefaults();
  }

  public seedDefaults() {
    this.setDocument('admins', 'admin_123', { role: 'ADMIN', active: true, updatedAt: new Date() });
    this.setDocument('admins', 'operator_123', { role: 'OPERATOR', active: true, updatedAt: new Date() });
    this.setDocument('admins', 'super_123', { role: 'SUPER_ADMIN', active: true, updatedAt: new Date() });
    this.setDocument('admins', 'user_admin_999', { role: 'ADMIN', active: true, updatedAt: new Date() });
    this.setDocument('admins', 'user_operator_999', { role: 'OPERATOR', active: true, updatedAt: new Date() });
    this.setDocument('admins', 'user_super_admin_999', { role: 'SUPER_ADMIN', active: true, updatedAt: new Date() });
    this.setDocument('users', 'player_123', { role: 'PLAYER', email: 'player@play369.com' });
    this.setDocument('users', 'user_player_123', { role: 'PLAYER', email: 'player@play369.com' });
    this.setDocument('users', 'vip_123', { role: 'VIP', email: 'vip@play369.com' });
    this.setDocument('users', 'user_vip_123', { role: 'VIP', email: 'vip@play369.com' });
  }

  public setDocument(collectionName: string, docId: string, data: Record<string, any>): void {
    if (!this.collections.has(collectionName)) {
      this.collections.set(collectionName, new Map());
    }
    this.collections.get(collectionName)!.set(docId, { ...data });
  }

  public getDocument(collectionName: string, docId: string): Record<string, any> | undefined {
    return this.collections.get(collectionName)?.get(docId);
  }

  public clear(): void {
    this.collections.clear();
  }

  public collection(collectionName: string) {
    const self = this;
    return {
      doc: (docId: string): AdminDbDocRef => ({
        get: async (): Promise<AdminDbDocSnapshot> => {
          const docData = self.getDocument(collectionName, docId);
          return {
            id: docId,
            exists: docData !== undefined,
            data: () => (docData ? { ...docData } : undefined)
          };
        },
        set: async (data: Record<string, any>, options?: any) => {
          if (options?.merge && self.getDocument(collectionName, docId)) {
            self.setDocument(collectionName, docId, { ...self.getDocument(collectionName, docId), ...data });
          } else {
            self.setDocument(collectionName, docId, data);
          }
          return { writeTime: new Date() };
        },
        update: async (data: Record<string, any>) => {
          const existing = self.getDocument(collectionName, docId) || {};
          self.setDocument(collectionName, docId, { ...existing, ...data });
          return { writeTime: new Date() };
        }
      })
    };
  }
}

let activeAuthAdapter: InMemoryAuthAdapter | null = null;
let activeDbAdapter: InMemoryDbAdapter | null = null;

export function setupHermeticAuthAndDb(): { auth: InMemoryAuthAdapter; db: InMemoryDbAdapter } {
  // Ensure NO Google Application Default Credentials or GCP credentials can be looked up
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GCLOUD_PROJECT;

  activeAuthAdapter = new InMemoryAuthAdapter();
  activeDbAdapter = new InMemoryDbAdapter();

  setAdminAuthAdapter(activeAuthAdapter);
  setAdminDbAdapter(activeDbAdapter);

  return { auth: activeAuthAdapter, db: activeDbAdapter };
}

export function teardownHermeticAuthAndDb(): void {
  resetAdminAdapters();
  activeAuthAdapter = null;
  activeDbAdapter = null;
}
