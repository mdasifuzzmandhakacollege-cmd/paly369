import { Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb } from '../lib/firebase-admin.js';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  userRole?: string;
  isAuthorizedAdmin?: boolean;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'ERROR',
      code: 'UNAUTHENTICATED',
      error: 'Unauthorized: Missing token',
      message: 'Unauthorized: Missing token'
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      status: 'ERROR',
      code: 'UNAUTHENTICATED',
      error: 'Unauthorized: Missing token',
      message: 'Unauthorized: Missing token'
    });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error: any) {
    console.error('Error verifying Firebase ID token:', error?.message || error);
    return res.status(401).json({
      status: 'ERROR',
      code: 'UNAUTHENTICATED',
      error: 'Unauthorized: Invalid token',
      message: 'Unauthorized: Invalid token'
    });
  }
};

/**
 * Resolves authoritative user role from token custom claims or server-side Firestore records.
 * NEVER trusts client-side state or hardcoded email whitelists.
 */
export async function getAuthoritativeUserRole(decodedToken: DecodedIdToken): Promise<string> {
  const uid = decodedToken.uid;

  // 1. Check custom claims on token
  const claimRole = (decodedToken.role || (decodedToken.admin ? 'ADMIN' : undefined) || (decodedToken.isAdmin ? 'ADMIN' : undefined));
  if (claimRole && typeof claimRole === 'string') {
    const upper = claimRole.toUpperCase();
    if (['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(upper)) {
      return upper;
    }
  }

  // 2. Check server-side Firestore /admins/{uid} collection
  try {
    const adminDoc = await adminDb.collection('admins').doc(uid).get();
    if (adminDoc.exists) {
      const data = adminDoc.data();
      const r = (data?.role || 'ADMIN').toUpperCase();
      if (['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(r)) {
        return r;
      }
    }
  } catch (err) {
    console.warn('[AuthMiddleware] Error checking admins collection:', err);
  }

  // 3. Check server-side Firestore /users/{uid} document
  try {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      const role = (data?.role || (data?.isAdmin ? 'ADMIN' : 'PLAYER')).toUpperCase();
      if (['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(role) || data?.isAdmin === true) {
        return role === 'PLAYER' ? 'ADMIN' : role;
      }
      if (role === 'VIP') return 'VIP';
    }
  } catch (err) {
    console.warn('[AuthMiddleware] Error checking users collection:', err);
  }

  return 'PLAYER';
}

/**
 * Server-side authorization middleware for ADMIN/OPERATOR/SUPER_ADMIN roles.
 * Returns:
 * - 401 if unauthenticated (missing or invalid token)
 * - 403 if authenticated but unauthorized (e.g. regular PLAYER / VIP)
 */
export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'ERROR',
      code: 'UNAUTHENTICATED',
      error: 'Unauthorized: Missing token',
      message: 'Unauthorized: Missing token'
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      status: 'ERROR',
      code: 'UNAUTHENTICATED',
      error: 'Unauthorized: Missing token',
      message: 'Unauthorized: Missing token'
    });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const authoritativeRole = await getAuthoritativeUserRole(decodedToken);
    req.userRole = authoritativeRole;

    const isPrivileged = ['ADMIN', 'OPERATOR', 'SUPER_ADMIN'].includes(authoritativeRole);
    if (!isPrivileged) {
      return res.status(403).json({
        status: 'ERROR',
        code: 'FORBIDDEN',
        error: 'Forbidden: Insufficient privileges',
        message: 'Forbidden: Admin or Operator access required'
      });
    }

    req.isAuthorizedAdmin = true;
    next();
  } catch (error: any) {
    console.error('Error in requireAdmin middleware:', error?.message || error);
    return res.status(401).json({
      status: 'ERROR',
      code: 'UNAUTHENTICATED',
      error: 'Unauthorized: Invalid token',
      message: 'Unauthorized: Invalid token'
    });
  }
};

export const requireOperator = requireAdmin;

