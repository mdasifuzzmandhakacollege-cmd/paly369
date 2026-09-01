/**
 * @file referralService.ts
 * @description Server-Authoritative Multi-Tier Referral & Affiliate Commission Service for Playall 365.
 * Strictly adheres to server authority:
 * 1. GET /api/affiliate/summary for real-time node metrics and recent commission logs.
 * 2. POST /api/affiliate/claim with verified Firebase Bearer token for server-side commission redemption.
 * 3. POST /api/affiliate/bind with verified Firebase Bearer token for immutable referral bonding.
 * 4. Captures URL parameter (?ref=code) into temporary localStorage only until registration bind.
 * 5. Zero client-side financial mutations, zero synthetic simulators, zero fake data.
 */

export interface AffiliateNodeData {
  userId: number;
  parentAffiliateId?: number | null;
  grandParentAffiliateId?: number | null;
  referralCode: string;
  totalDirectReferrals: number;
  totalSubordinates: number;
  totalTurnoverVolume: string;
  totalCommissionEarned: string;
  unclaimedCommission: string;
  status?: string;
}

export interface AffiliateCommissionRecord {
  id: number;
  beneficiaryUserId: number;
  sourceUserId: number;
  sourceTransactionId: string;
  tier: number;
  validBetAmount: string;
  commissionRate: string;
  commissionAmount: string;
  currency: string;
  status: 'PENDING' | 'SETTLED' | 'CLAIMED' | 'CANCELLED' | string;
  settledAt: string;
}

export interface AffiliateSummaryResponse {
  node: AffiliateNodeData;
  recentCommissions: AffiliateCommissionRecord[];
}

export interface ClaimCommissionResult {
  claimedAmount: string;
  newRealBalance: string;
  transactionId: string;
  ledgerEntryId?: number;
  isIdempotent?: boolean;
}

const REFERRAL_STORAGE_KEY = 'playall365_referral_code';

class ReferralService {
  private listeners: Array<() => void> = [];

  /**
   * Automatically captures referral code from URL query parameters on initial page load
   * Stores ONLY the temporary referral code string until consumption.
   */
  public captureReferralFromUrl(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      let refCode =
        urlParams.get('ref') ||
        urlParams.get('referral') ||
        urlParams.get('aff') ||
        urlParams.get('r');

      // Also check hash routing if present (e.g. #/register?ref=xxx)
      if (!refCode && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.split('?')[1];
        const hashParams = new URLSearchParams(hashQuery);
        refCode =
          hashParams.get('ref') ||
          hashParams.get('referral') ||
          hashParams.get('aff') ||
          hashParams.get('r');
      }

      if (refCode && refCode.trim()) {
        const sanitized = refCode.trim();
        localStorage.setItem(REFERRAL_STORAGE_KEY, sanitized);
        return sanitized;
      }
    } catch (e) {
      console.warn('[ReferralService] Error capturing referral URL param:', e);
    }

    return this.getStoredReferralCode();
  }

  /**
   * Retrieves the currently stored temporary referral code from localStorage
   */
  public getStoredReferralCode(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFERRAL_STORAGE_KEY);
  }

  /**
   * Clears stored temporary referral code after successful registration/binding
   */
  public clearStoredReferralCode(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  }

  /**
   * Generates the authoritative referral share link based on domain origin and server-supplied referralCode
   */
  public generateReferralLink(referralCode: string): string {
    if (typeof window === 'undefined') {
      return `https://playall365.vip/?ref=${encodeURIComponent(referralCode || '')}`;
    }

    const origin = window.location.origin;
    const cleanCode = (referralCode || '').trim();
    return `${origin}/?ref=${encodeURIComponent(cleanCode)}`;
  }

  /**
   * Helper to generate ready-to-share social media URLs with server referral link
   */
  public getShareLinks(referralLink: string, referralCode?: string) {
    const codeText = referralCode ? ` [কোড: ${referralCode}]` : '';
    const promoText = `🔥 Playall 365 এ যোগ দিয়ে জিতে নিন আজীবন এফিলিয়েট কমিশন! আমার রেফারেল লিঙ্ক: ${referralLink}${codeText}`;

    return {
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(promoText)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Playall 365 লাইভ ক্যাসিনো ও আর্নিং হাব!')}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
      copyText: referralLink
    };
  }

  /**
   * Authoritatively fetches affiliate summary from PostgreSQL backend.
   */
  public async fetchAffiliateSummary(
    authToken: string
  ): Promise<{ success: boolean; data?: AffiliateSummaryResponse; error?: string }> {
    try {
      const res = await fetch('/api/affiliate/summary', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });

      const json = await res.json();
      if (!res.ok || json.status === 'ERROR') {
        return {
          success: false,
          error: json.message || 'Failed to fetch affiliate summary'
        };
      }

      return {
        success: true,
        data: json.data
      };
    } catch (err: any) {
      console.error('[ReferralService] fetchAffiliateSummary network error:', err);
      return {
        success: false,
        error: err.message || 'Network error fetching affiliate data'
      };
    }
  }

  /**
   * Claims unclaimed affiliate commission authoritatively on the server via POST /api/affiliate/claim.
   * Updates PostgreSQL wallet balance directly through ACID ledger transactions.
   */
  public async claimCommissionOnServer(
    authToken: string
  ): Promise<{ success: boolean; data?: ClaimCommissionResult; error?: string }> {
    try {
      const res = await fetch('/api/affiliate/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });

      const json = await res.json();
      if (!res.ok || json.status === 'ERROR') {
        return {
          success: false,
          error: json.message || 'Commission claim failed'
        };
      }

      this.notifyListeners();
      return {
        success: true,
        data: json.data
      };
    } catch (err: any) {
      console.error('[ReferralService] claimCommissionOnServer error:', err);
      return {
        success: false,
        error: err.message || 'Network error claiming commission'
      };
    }
  }

  /**
   * Bind authenticated user to a sponsor authoritatively on the server via POST /api/affiliate/bind.
   * Never mutates client balances directly.
   */
  public async bindReferralOnServer(
    referralCode: string,
    authToken: string
  ): Promise<{ success: boolean; data?: any; error?: string; isIdempotent?: boolean }> {
    try {
      const res = await fetch('/api/affiliate/bind', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ referralCode })
      });

      const json = await res.json();
      if (!res.ok || json.status === 'ERROR') {
        return {
          success: false,
          error: json.message || 'Referral binding failed'
        };
      }

      this.clearStoredReferralCode();
      this.notifyListeners();

      return {
        success: true,
        data: json.data,
        isIdempotent: json.data?.isIdempotent || false
      };
    } catch (err: any) {
      console.error('[ReferralService] bindReferralOnServer error:', err);
      return {
        success: false,
        error: err.message || 'Network error communicating with referral service'
      };
    }
  }

  // --- Subscriptions for reactive updates ---
  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  public notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('[ReferralService] listener error:', e);
      }
    });
  }
}

export const referralService = new ReferralService();
