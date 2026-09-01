/**
 * @file firebase-admin.ts
 * @description Dependency-injected Firebase Admin Auth and Firestore boundary.
 * Provides lazy production initialization and hermetic mock adapter injection for CI testing.
 */

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth, DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export interface AdminAuthAdapter {
  verifyIdToken(token: string, checkRevoked?: boolean): Promise<DecodedIdToken>;
  getUser?(uid: string): Promise<any>;
}

export interface AdminDbDocSnapshot {
  id: string;
  exists: boolean;
  data(): Record<string, any> | undefined;
}

export interface AdminDbDocRef {
  get(): Promise<AdminDbDocSnapshot>;
  set?(data: Record<string, any>, options?: any): Promise<any>;
  update?(data: Record<string, any>): Promise<any>;
}

export interface AdminDbCollectionRef {
  doc(docId: string): AdminDbDocRef;
}

export interface AdminDbAdapter {
  collection(collectionName: string): AdminDbCollectionRef;
}

// Internal lazy state
let realApp: App | null = null;
let realAuth: Auth | null = null;
let realDb: Firestore | null = null;

let customAuthAdapter: AdminAuthAdapter | null = null;
let customDbAdapter: AdminDbAdapter | null = null;

function getLazyApp(): App {
  if (!realApp) {
    const apps = getApps();
    if (apps.length > 0) {
      realApp = apps[0];
    } else {
      realApp = initializeApp({
        projectId: firebaseConfig.projectId,
      });
    }
  }
  return realApp;
}

function getLazyAuth(): Auth {
  if (!realAuth) {
    realAuth = getAuth(getLazyApp());
  }
  return realAuth;
}

function getLazyDb(): Firestore {
  if (!realDb) {
    realDb = getFirestore(getLazyApp());
  }
  return realDb;
}

/**
 * Injects a mock or in-memory Auth Adapter for unit/integration testing.
 */
export function setAdminAuthAdapter(adapter: AdminAuthAdapter | null): void {
  customAuthAdapter = adapter;
}

/**
 * Injects a mock or in-memory Firestore Adapter for unit/integration testing.
 */
export function setAdminDbAdapter(adapter: AdminDbAdapter | null): void {
  customDbAdapter = adapter;
}

/**
 * Resets adapters to use lazy production Firebase Admin clients.
 */
export function resetAdminAdapters(): void {
  customAuthAdapter = null;
  customDbAdapter = null;
}

/**
 * Returns whether custom mock adapters are currently active.
 */
export function hasCustomAdminAdapters(): boolean {
  return customAuthAdapter !== null || customDbAdapter !== null;
}

/**
 * Delegated adminAuth interface conforming to AdminAuthAdapter.
 * Forwards calls to customAuthAdapter if injected, or lazily initializes production Firebase Auth.
 */
export const adminAuth: AdminAuthAdapter = {
  verifyIdToken: async (token: string, checkRevoked?: boolean): Promise<DecodedIdToken> => {
    if (customAuthAdapter) {
      return customAuthAdapter.verifyIdToken(token, checkRevoked);
    }
    return getLazyAuth().verifyIdToken(token, checkRevoked);
  },
  getUser: async (uid: string): Promise<any> => {
    if (customAuthAdapter && customAuthAdapter.getUser) {
      return customAuthAdapter.getUser(uid);
    }
    return getLazyAuth().getUser(uid);
  },
};

/**
 * Delegated adminDb interface conforming to AdminDbAdapter.
 * Forwards calls to customDbAdapter if injected, or lazily initializes production Firestore.
 */
export const adminDb: AdminDbAdapter = {
  collection: (collectionName: string): AdminDbCollectionRef => {
    if (customDbAdapter) {
      return customDbAdapter.collection(collectionName);
    }
    return getLazyDb().collection(collectionName) as unknown as AdminDbCollectionRef;
  },
};


