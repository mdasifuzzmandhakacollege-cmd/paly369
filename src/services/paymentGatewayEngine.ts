/**
 * @file paymentGatewayEngine.ts
 * @description Master Payment Orchestrator, Verification Engine, Double-Entry Ledger,
 * and Number Rotation Pool for Gameplay 365.
 */

import {
  PaymentProviderId,
  PaymentMethod,
  DepositStatus,
  WithdrawalStatus,
  PaymentDestinationAccount,
  DepositIntent,
  DepositIntentRequest,
  PaymentVerificationResult,
  WithdrawalPayoutRequest,
  WithdrawalRecord,
  DoubleEntryLedgerEntry,
  WebhookLog,
  AuditLogEntry,
  RiskAnalysis
} from '../server/types/paymentGateway';
import {
  PaymentProviderAdapter,
  BkashPaymentAdapter,
  NagadPaymentAdapter,
  RocketPaymentAdapter,
  BankTransferPaymentAdapter,
  CardPaymentAdapter
} from './paymentAdapters';
import { notificationService } from './notificationService';
import { soundEngine } from './soundEngine';
import { webhookLogger } from './webhookLogger';
import { validatePaymentAmount, fromScale4, toScale4 } from '../server/utils/paymentAmount';

export class PaymentGatewayEngine {
  // 1. Provider Adapter Registry
  private adapters: Map<PaymentProviderId, PaymentProviderAdapter> = new Map();

  // 2. Payment Destination Accounts Pool (Dynamic Rotation)
  private destinationPool: PaymentDestinationAccount[] = [
    {
      id: 'DEST_BKASH_01',
      provider: 'bkash',
      method: 'BKASH',
      accountNumber: '01900-112233',
      accountName: 'Gameplay365 VIP Merchant Pool A',
      accountType: 'MERCHANT',
      dailyLimit: 500000,
      currentDayVolume: 124500,
      assignedCapacityPercent: 75,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'আপনার বিকাশ অ্যাপ থেকে "Make Payment" অপশন নির্বাচন করুন।',
        'মার্চেন্ট নম্বর: 01900-112233 লিখুন।',
        'নির্ধারিত টাকার পরিমাণ লিখুন এবং রেফারেন্স হিসেবে আপনার ডিপোজিট আইডি দিন।',
        'পিন দিয়ে পেমেন্ট সম্পন্ন করে TrxID সংগ্রহ করুন।'
      ]
    },
    {
      id: 'DEST_BKASH_02',
      provider: 'bkash',
      method: 'BKASH',
      accountNumber: '01977-889900',
      accountName: 'Gameplay365 Fast Cashout Pool B',
      accountType: 'AGENT',
      dailyLimit: 300000,
      currentDayVolume: 45000,
      assignedCapacityPercent: 40,
      isActive: true,
      isMaintenance: false,
      priority: 2,
      instructions: [
        'বিকাশ অ্যাপে "Cash Out" অপশন বেছে নিন।',
        'এজেন্ট নম্বর: 01977-889900 বসিয়ে পিন দিয়ে ক্যাশ-আউট করুন।',
        'সফল মেসেজ থেকে TrxID কপি করে ভেরিফাই করুন।'
      ]
    },
    {
      id: 'DEST_NAGAD_01',
      provider: 'nagad',
      method: 'NAGAD',
      accountNumber: '01844-992200',
      accountName: 'Gameplay365 Direct Nagad Agent',
      accountType: 'AGENT',
      dailyLimit: 400000,
      currentDayVolume: 89000,
      assignedCapacityPercent: 60,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'নগদ অ্যাপ খুলুন বা *167# ডায়াল করে Cash Out নির্বাচন করুন।',
        'এজেন্ট নম্বর: 01844-992200 প্রবেশ করান।',
        'টাকার পরিমাণ ও পিন দিয়ে ট্রানজেকশন সফল করুন।',
        'নগদের ৮ ডিজিটের TrxID সাবমিট করুন।'
      ]
    },
    {
      id: 'DEST_ROCKET_01',
      provider: 'rocket',
      method: 'ROCKET',
      accountNumber: '01711-884422-9',
      accountName: 'Gameplay365 DBBL Biller Account',
      accountType: 'BILLER',
      dailyLimit: 300000,
      currentDayVolume: 24000,
      assignedCapacityPercent: 30,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'রকেট অ্যাপ থেকে Send Money বা Pay Bill অপশন ব্যবহার করুন।',
        'একাউন্ট নম্বর: 01711-884422-9 দিন।',
        'পিন দিয়ে ট্রানজেকশন শেষ করে TrxID কপি করুন।'
      ]
    },
    {
      id: 'DEST_BANK_01',
      provider: 'bank_transfer',
      method: 'BANK_TRANSFER',
      accountNumber: '110.120.489102',
      accountName: 'Gameplay365 Online Entertainment Ltd',
      accountType: 'BANK_ACCOUNT',
      bankName: 'City Bank Ltd / Brac Bank PLC',
      branchName: 'Gulshan Corporate Branch, Dhaka',
      routingNumber: '225271890',
      dailyLimit: 2000000,
      currentDayVolume: 420000,
      assignedCapacityPercent: 50,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'Citytouch বা Astha অ্যাপের মাধ্যমে NPSB/BEFTN ফান্ড ট্রান্সফার করুন।',
        'একাউন্ট নম্বর: 110.120.489102 (City Bank)',
        'রাউটিং নম্বর: 225271890',
        'ট্রান্সফারের রেফারেন্স/TrxID লিখে সাবমিট করুন।'
      ]
    },
    {
      id: 'DEST_USDT_01',
      provider: 'usdt_crypto',
      method: 'USDT',
      accountNumber: 'TK89xVqLiveSeamlessCasinoCryptoVault99201',
      accountName: 'Gameplay365 Multi-Sig Cold Vault',
      accountType: 'CRYPTO_VAULT',
      dailyLimit: 5000000,
      currentDayVolume: 1100000,
      assignedCapacityPercent: 35,
      isActive: true,
      isMaintenance: false,
      priority: 1,
      instructions: [
        'Binance/TrustWallet থেকে TRC-20 নেটওয়ার্কে ট্রান্সফার করুন।',
        'অ্যাড্রেস: TK89xVqLiveSeamlessCasinoCryptoVault99201',
        'ট্রানজেকশনের TxHash পেস্ট করুন।'
      ]
    }
  ];

  // 3. In-Memory Stores
  private depositIntents: Map<string, DepositIntent> = new Map();
  private consumedTrxIds: Map<string, { depositId: string; userId: string; consumedAt: string }> = new Map(); // Key: `${provider}:${trxId}`
  private withdrawalRecords: Map<string, WithdrawalRecord> = new Map();
  private doubleEntryLedger: DoubleEntryLedgerEntry[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private webhookLogs: WebhookLog[] = [];
  private idempotencyStore: Map<string, any> = new Map();

  // 4. Listeners for Real-time Reactive Updates
  private changeListeners: Array<() => void> = [];

  constructor() {
    this.registerAdapters();
    this.seedInitialHistory();
  }

  private registerAdapters() {
    this.adapters.set('bkash', new BkashPaymentAdapter());
    this.adapters.set('nagad', new NagadPaymentAdapter());
    this.adapters.set('rocket', new RocketPaymentAdapter());
    this.adapters.set('bank_transfer', new BankTransferPaymentAdapter());
    this.adapters.set('card_payment', new CardPaymentAdapter());
    this.adapters.set('usdt_crypto', new CardPaymentAdapter());
  }

  public subscribe(listener: () => void) {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }

  private notifyChange() {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (err) {
        console.error('PaymentGatewayEngine listener error:', err);
      }
    }
  }

  // ==========================================================================
  // SECTION 1: Payment Destination Pool Rotation Algorithm
  // ==========================================================================
  public getAvailableDestination(provider: PaymentProviderId): PaymentDestinationAccount {
    const candidates = this.destinationPool.filter(
      (d) => d.provider === provider && d.isActive && !d.isMaintenance
    );

    if (candidates.length === 0) {
      // Fallback to first matching or default
      const fallback = this.destinationPool.find((d) => d.provider === provider) || this.destinationPool[0];
      return fallback;
    }

    // Sort by available capacity (dailyLimit - currentDayVolume) and priority
    candidates.sort((a, b) => {
      const remainingA = a.dailyLimit - a.currentDayVolume;
      const remainingB = b.dailyLimit - b.currentDayVolume;
      if (remainingA !== remainingB) {
        return remainingB - remainingA; // Higher remaining capacity first
      }
      return a.priority - b.priority;
    });

    return candidates[0];
  }

  public getDestinationPool(): PaymentDestinationAccount[] {
    return [...this.destinationPool];
  }

  public updateDestinationStatus(id: string, updates: Partial<PaymentDestinationAccount>) {
    const dest = this.destinationPool.find((d) => d.id === id);
    if (dest) {
      Object.assign(dest, updates);
      this.logAudit({
        actor: 'ADMIN:System',
        action: 'UPDATE_DESTINATION_ACCOUNT',
        resource: 'DESTINATION_POOL',
        resourceId: id,
        ipAddress: '127.0.0.1',
        metadata: updates
      });
      this.notifyChange();
    }
  }

  // ==========================================================================
  // SECTION 2: Anti-Fraud & Risk Engine
  // ==========================================================================
  public analyzeRisk(params: {
    userId: string;
    amount: string | number | bigint;
    provider: PaymentProviderId;
    trxId?: string;
    recipientAccount?: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
  }): RiskAnalysis {
    let score = 5; // Base clean score
    const factors: string[] = [];

    // Check 1: Duplicate TrxID Attempt
    if (params.trxId) {
      const cleanTrx = params.trxId.trim().toUpperCase();
      const existingKey = `${params.provider}:${cleanTrx}`;
      if (this.consumedTrxIds.has(existingKey)) {
        score += 90;
        factors.push('DUPLICATE_TRX_ID_DETECTED');
      }
    }

    // Check 2: Amount Anomalies (e.g. unusually high single deposit > 100,000.0000 = 1000000000n)
    try {
      const amountMinor = typeof params.amount === 'bigint' ? params.amount : toScale4(String(params.amount));
      if (amountMinor > 1000000000n) {
        score += 25;
        factors.push('HIGH_VALUE_TRANSACTION');
      }
    } catch {
      // Ignored for non-standard inputs in risk pass
    }

    // Check 3: Velocity Check (Multiple rapid intents within 5 minutes)
    const now = Date.now();
    const recentIntents = Array.from(this.depositIntents.values()).filter(
      (d) => d.userId === params.userId && now - new Date(d.createdAt).getTime() < 300000
    );
    if (recentIntents.length >= 4) {
      score += 35;
      factors.push('RAPID_INTENT_VELOCITY');
    }

    // Check 4: Failed transaction frequency
    const failedRecent = recentIntents.filter((d) => d.status === 'FAILED');
    if (failedRecent.length >= 2) {
      score += 30;
      factors.push('REPEATED_FAILED_ATTEMPTS');
    }

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED' = 'LOW';
    if (score >= 80) riskLevel = 'BLOCKED';
    else if (score >= 60) riskLevel = 'HIGH';
    else if (score >= 30) riskLevel = 'MEDIUM';

    return {
      riskScore: Math.min(100, score),
      riskLevel,
      factors,
      isBlocked: score >= 80,
      requiresManualReview: score >= 60 && score < 80
    };
  }

  // ==========================================================================
  // SECTION 3: Step 01 & 02 — Deposit Intent Creation Flow
  // ==========================================================================
  public createDepositIntent(req: DepositIntentRequest): DepositIntent {
    // Idempotency check
    if (req.idempotencyKey && this.idempotencyStore.has(req.idempotencyKey)) {
      return this.idempotencyStore.get(req.idempotencyKey);
    }

    const parsed = validatePaymentAmount(req.amount);
    const amountStr = parsed.decimalString;
    const amountMinor = parsed.minorUnits;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const depositId = `DEP-${dateStr}-${randomSuffix}`;
    const destination = this.getAvailableDestination(req.provider);

    const risk = this.analyzeRisk({
      userId: req.userId,
      amount: amountMinor,
      provider: req.provider,
      type: 'DEPOSIT'
    });

    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 mins expiry

    const intent: DepositIntent = {
      id: depositId,
      userId: req.userId,
      username: req.username,
      provider: req.provider,
      method: req.method,
      amount: amountStr,
      amountMinor: amountMinor.toString(),
      currency: req.currency,
      status: 'AWAITING_PAYMENT',
      destinationAccount: destination,
      referenceCode: depositId,
      createdAt: now.toISOString(),
      expiresAt: expiresAt,
      riskScore: risk.riskScore,
      idempotencyKey: req.idempotencyKey,
      auditTrail: [
        {
          status: 'CREATED',
          timestamp: now.toISOString(),
          note: `Deposit Intent created for ৳${amountStr} via ${req.provider.toUpperCase()}`
        },
        {
          status: 'AWAITING_PAYMENT',
          timestamp: now.toISOString(),
          note: `Destination assigned: ${destination.accountNumber} (${destination.accountType})`
        }
      ]
    };

    this.depositIntents.set(depositId, intent);

    if (req.idempotencyKey) {
      this.idempotencyStore.set(req.idempotencyKey, intent);
    }

    this.logAudit({
      actor: `USER:${req.username}`,
      action: 'CREATE_DEPOSIT_INTENT',
      resource: 'DEPOSIT',
      resourceId: depositId,
      ipAddress: req.clientIp || '127.0.0.1',
      metadata: { amount: amountStr, amountMinor: amountMinor.toString(), provider: req.provider, destination: destination.accountNumber }
    });

    this.notifyChange();
    return intent;
  }

  // ==========================================================================
  // SECTION 4: Step 03 & 04 — Automatic Payment Verification & Instant Credit Engine
  // ==========================================================================
  public async verifyAndCreditDeposit(params: {
    depositId: string;
    trxId: string;
    senderNumber?: string;
  }): Promise<{
    success: boolean;
    depositIntent: DepositIntent;
    status: string;
    code: string;
    message: string;
    newBalance?: number;
  }> {
    const intent = this.depositIntents.get(params.depositId);
    if (!intent) {
      throw new Error(`Deposit intent '${params.depositId}' not found.`);
    }

    if (intent.status === 'CREDITED') {
      return {
        success: true,
        depositIntent: intent,
        status: 'CREDITED',
        code: 'ALREADY_CREDITED',
        message: 'This deposit has already been verified and credited.'
      };
    }

    const cleanTrx = params.trxId.trim().toUpperCase();
    intent.status = 'TRX_SUBMITTED';
    intent.providerTransactionId = cleanTrx;
    intent.senderNumber = params.senderNumber;
    intent.auditTrail.push({
      status: 'TRX_SUBMITTED',
      timestamp: new Date().toISOString(),
      note: `Player submitted TrxID: ${cleanTrx}`
    });

    this.notifyChange();

    // ------------------------------------------------------------------------
    // Strict 8-Point Verification Engine Execution
    // ------------------------------------------------------------------------
    // Check 1: Expiry
    if (new Date() > new Date(intent.expiresAt)) {
      intent.status = 'EXPIRED';
      intent.failedReason = 'Payment window expired (15 minutes limit exceeded).';
      intent.auditTrail.push({
        status: 'EXPIRED',
        timestamp: new Date().toISOString(),
        note: intent.failedReason
      });
      this.notifyChange();
      throw new Error(intent.failedReason);
    }

    // Check 2: Duplicate TrxID Prevention
    const trxKey = `${intent.provider}:${cleanTrx}`;
    if (this.consumedTrxIds.has(trxKey)) {
      intent.status = 'FAILED';
      intent.failedReason = `Duplicate TrxID: '${cleanTrx}' has already been used on Gameplay 365.`;
      intent.riskScore = 95;
      intent.auditTrail.push({
        status: 'FAILED',
        timestamp: new Date().toISOString(),
        note: intent.failedReason
      });
      this.logAudit({
        actor: `USER:${intent.username}`,
        action: 'DUPLICATE_TRX_ID_REJECTED',
        resource: 'DEPOSIT',
        resourceId: intent.id,
        ipAddress: '127.0.0.1',
        metadata: { trxId: cleanTrx, provider: intent.provider }
      });
      this.notifyChange();
      throw new Error(intent.failedReason);
    }

    // Check 3: Provider API Adapter Verification
    intent.status = 'VERIFYING';
    const adapter = this.adapters.get(intent.provider) || new BkashPaymentAdapter();

    const verificationResult: PaymentVerificationResult = await adapter.verifyDeposit({
      depositIntent: intent,
      trxId: cleanTrx,
      senderNumber: params.senderNumber,
      destinationAccount: intent.destinationAccount
    });

    if (!verificationResult.verified) {
      const isUnconfigured = verificationResult.code === 'PROVIDER_NOT_CONFIGURED' || verificationResult.status === 'PENDING_INTEGRATION';
      intent.status = isUnconfigured ? 'PENDING_INTEGRATION' : 'FAILED';
      intent.failedReason = verificationResult.message;
      intent.auditTrail.push({
        status: intent.status,
        timestamp: new Date().toISOString(),
        note: `Verification halted: ${verificationResult.message}`
      });
      this.notifyChange();
      const err = new Error(verificationResult.message);
      (err as any).code = verificationResult.code || 'VERIFICATION_FAILED';
      (err as any).status = intent.status;
      throw err;
    }

    // ------------------------------------------------------------------------
    // Step 05: Provider Verification Confirmed — Awaiting Authoritative Ledger Settlement
    // ------------------------------------------------------------------------
    // CRITICAL (TASK 6.1.2): Provider verification alone sets AWAITING_LEDGER_SETTLEMENT.
    // It must NEVER mark the deposit as CREDITED or emit phantom wallet credit signals.
    // CREDITED is allowed ONLY after authoritative WalletLedgerService settlement succeeds.
    intent.status = 'AWAITING_LEDGER_SETTLEMENT';
    intent.providerTransactionId = verificationResult.providerTransactionId || cleanTrx;
    intent.verifiedAt = new Date().toISOString();
    intent.auditTrail.push({
      status: 'AWAITING_LEDGER_SETTLEMENT',
      timestamp: intent.verifiedAt,
      note: `Payment authorized and verified by Provider (${intent.provider.toUpperCase()}). Awaiting authoritative WalletLedgerService settlement.`
    });

    // Mark TrxID as consumed in the idempotency pool
    this.consumedTrxIds.set(trxKey, {
      depositId: intent.id,
      userId: intent.userId,
      consumedAt: new Date().toISOString()
    });

    // Update Destination Account daily volume tracking
    try {
      const addedVolume = Number(toScale4(String(intent.amount)) / 10000n);
      intent.destinationAccount.currentDayVolume += addedVolume;
    } catch {
      // Ignore
    }

    // Log Immutable Verification Audit (without emitting phantom WALLET_DEPOSIT_CREDITED)
    this.logAudit({
      actor: 'SYSTEM:PaymentVerificationEngine',
      action: 'DEPOSIT_PROVIDER_VERIFIED',
      resource: 'DEPOSIT',
      resourceId: intent.id,
      ipAddress: '127.0.0.1',
      metadata: {
        userId: intent.userId,
        amount: intent.amount,
        trxId: cleanTrx,
        provider: intent.provider,
        providerTransactionId: intent.providerTransactionId,
        settlementStatus: 'LEDGER_SETTLEMENT_PENDING'
      }
    });

    this.notifyChange();

    return {
      success: true,
      depositIntent: intent,
      status: 'LEDGER_SETTLEMENT_PENDING',
      code: 'LEDGER_SETTLEMENT_PENDING',
      message: `পেমেন্ট প্রোভাইডার দ্বারা অনুমোদিত হয়েছে (TrxID: ${cleanTrx})। ওয়ালেট লেজার সেটেলমেন্টের অপেক্ষায় রয়েছে।`
    };
  }

  /**
   * Settle deposit to CREDITED status ONLY after authoritative WalletLedgerService settlement succeeds.
   */
  public settleDepositWithLedger(depositId: string, settlement: { ledgerTransactionId: string; creditedAt?: string }): DepositIntent {
    const intent = this.depositIntents.get(depositId);
    if (!intent) {
      throw new Error(`Deposit intent '${depositId}' not found for ledger settlement.`);
    }
    if (intent.status === 'CREDITED') {
      return intent;
    }
    if (intent.status !== 'VERIFIED' && intent.status !== 'AWAITING_LEDGER_SETTLEMENT') {
      throw new Error(`Cannot credit deposit in status '${intent.status}'. Deposit must be VERIFIED or AWAITING_LEDGER_SETTLEMENT.`);
    }
    intent.status = 'CREDITED';
    intent.creditedAt = settlement.creditedAt || new Date().toISOString();
    intent.auditTrail.push({
      status: 'CREDITED',
      timestamp: intent.creditedAt,
      note: `Authoritative WalletLedgerService settlement committed. Ledger Ref: ${settlement.ledgerTransactionId}`
    });

    this.logAudit({
      actor: 'SYSTEM:WalletLedgerService',
      action: 'WALLET_DEPOSIT_CREDITED',
      resource: 'WALLET',
      resourceId: intent.id,
      ipAddress: '127.0.0.1',
      metadata: {
        userId: intent.userId,
        amount: intent.amount,
        ledgerTransactionId: settlement.ledgerTransactionId
      }
    });

    this.notifyChange();
    return intent;
  }

  // ==========================================================================
  // SECTION 5: Controlled Withdrawal Flow with Fail-Closed Provider Gate
  // ==========================================================================
  public async requestWithdrawal(req: WithdrawalPayoutRequest): Promise<WithdrawalRecord> {
    const adapter = this.adapters.get(req.provider) || new BkashPaymentAdapter();

    // Fail-Closed: Production payment flow must never mutate monetary state through simulated engines.
    // Real provider and wallet settlement requires configured live gateway and WalletLedgerService.
    if (!adapter.isConfigured()) {
      const err = new Error(`Payment provider '${req.provider}' payout gateway is not configured.`);
      (err as any).code = 'PROVIDER_NOT_CONFIGURED';
      (err as any).status = 'PENDING_INTEGRATION';
      throw err;
    }

    const err = new Error(`Payment provider '${req.provider}' live payout integration is pending.`);
    (err as any).code = 'PROVIDER_NOT_CONFIGURED';
    (err as any).status = 'PENDING_INTEGRATION';
    throw err;
  }

  public releaseWithdrawalReservation(record: WithdrawalRecord, failureReason: string) {
    record.status = 'FAILED';
    record.failedReason = failureReason;
    record.auditTrail.push({
      status: 'FAILED',
      timestamp: new Date().toISOString(),
      note: `Payout failed: ${failureReason}.`
    });

    notificationService.pushNotification(record.userId, {
      userId: record.userId,
      title: '⚠️ উইথড্রয়াল ব্যর্থ হয়েছে',
      message: `উইথড্রয়াল প্রক্রিয়া সম্পন্ন করা যায়নি।`,
      type: 'SYSTEM_ALERT',
      amount: record.amount,
      currency: record.currency,
      isRead: false
    });

    this.notifyChange();
  }

  // ==========================================================================
  // ==========================================================================
  // SECTION 6: Webhook Processing Engine & Inspector Controls (Delegated to WebhookLogger)
  // ==========================================================================
  public async handleWebhook(
    provider: PaymentProviderId | string,
    payload: Record<string, any>,
    signature: string,
    options?: {
      eventType?: string;
      headers?: Record<string, string>;
      expectedSignature?: string;
      simulatedLatency?: number;
      ipAddress?: string;
    }
  ): Promise<WebhookLog> {
    const log = await webhookLogger.interceptAndLog({
      provider,
      payload,
      signature,
      options
    });

    this.logAudit({
      actor: `GATEWAY_WEBHOOK:${provider}`,
      action: log.signatureValid ? 'WEBHOOK_PROCESSED' : 'WEBHOOK_REJECTED_SIGNATURE',
      resource: 'PROVIDER',
      resourceId: log.id,
      ipAddress: options?.ipAddress || '103.119.100.45',
      metadata: { eventId: log.eventId, eventType: log.eventType, signatureValid: log.signatureValid }
    });

    this.notifyChange();
    return log;
  }

  /**
   * Re-processes an existing webhook event to simulate retry / replay
   */
  public async reprocessWebhook(webhookId: string): Promise<{ success: boolean; message: string; log: WebhookLog }> {
    const result = await webhookLogger.reprocessWebhook(webhookId);

    this.logAudit({
      actor: 'DEVELOPER_WORKBENCH',
      action: 'WEBHOOK_REPROCESSED',
      resource: 'PROVIDER',
      resourceId: result.log.id,
      ipAddress: '127.0.0.1 (Workbench)',
      metadata: { retryCount: result.log.retryCount, success: result.success, eventId: result.log.eventId }
    });

    this.notifyChange();
    return result;
  }

  public clearWebhookLogs() {
    webhookLogger.clearLogs();
    this.notifyChange();
  }

  // ==========================================================================
  // SECTION 7: Audit Logging & Getters
  // ==========================================================================
  private logAudit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) {
    this.auditLogs.unshift({
      id: `AUDIT_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString(),
      ...entry
    });
  }

  public getDepositIntents(userId?: string): DepositIntent[] {
    const list = Array.from(this.depositIntents.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (userId) return list.filter((d) => d.userId === userId);
    return list;
  }

  public getDepositIntent(id: string): DepositIntent | undefined {
    return this.depositIntents.get(id);
  }

  public getWithdrawalRecords(userId?: string): WithdrawalRecord[] {
    const list = Array.from(this.withdrawalRecords.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (userId) return list.filter((w) => w.userId === userId);
    return list;
  }

  public getDoubleEntryLedger(): DoubleEntryLedgerEntry[] {
    return [...this.doubleEntryLedger];
  }

  public getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  public getWebhookLogs(): WebhookLog[] {
    return webhookLogger.getLogs();
  }

  public getStats() {
    const deposits = Array.from(this.depositIntents.values());
    const withdrawals = Array.from(this.withdrawalRecords.values());
    const webhookStats = webhookLogger.getStats();

    let totalDepositedMinor = 0n;
    for (const d of deposits) {
      if (d.status === 'CREDITED') {
        try {
          totalDepositedMinor += toScale4(String(d.amount));
        } catch {
          // ignore
        }
      }
    }

    let totalWithdrawnMinor = 0n;
    for (const w of withdrawals) {
      if (w.status === 'WITHDRAWAL_COMPLETED') {
        try {
          totalWithdrawnMinor += toScale4(String(w.amount));
        } catch {
          // ignore
        }
      }
    }

    const totalDeposited = Number(fromScale4(totalDepositedMinor));
    const totalWithdrawn = Number(fromScale4(totalWithdrawnMinor));

    const pendingDeposits = deposits.filter((d) => d.status === 'AWAITING_PAYMENT' || d.status === 'TRX_SUBMITTED').length;
    const pendingWithdrawals = withdrawals.filter((w) => w.status === 'WITHDRAWAL_RESERVED' || w.status === 'PAYOUT_PROCESSING').length;

    return {
      totalDeposited,
      totalWithdrawn,
      netCashFlow: totalDeposited - totalWithdrawn,
      pendingDeposits,
      pendingWithdrawals,
      totalIntents: deposits.length,
      totalWithdrawals: withdrawals.length,
      activeGateways: this.destinationPool.filter((d) => d.isActive && !d.isMaintenance).length,
      totalWebhooks: webhookStats.total,
      validWebhooks: webhookStats.valid
    };
  }

  // Seed initial transactions for rich presentation
  private seedInitialHistory() {
    const now = Date.now();
    // Pre-seed sample completed deposits
    const sampleDep: DepositIntent = {
      id: 'DEP-20260821-9A41K',
      userId: 'u_10291',
      username: 'Tamim_Sultana',
      provider: 'bkash',
      method: 'BKASH',
      amount: '5000.0000',
      currency: 'BDT',
      status: 'CREDITED',
      destinationAccount: this.destinationPool[0],
      referenceCode: 'DEP-20260821-9A41K',
      providerTransactionId: 'BL92A81K09',
      senderNumber: '01712-349911',
      createdAt: new Date(now - 3600000).toISOString(),
      expiresAt: new Date(now - 2700000).toISOString(),
      verifiedAt: new Date(now - 3550000).toISOString(),
      creditedAt: new Date(now - 3540000).toISOString(),
      riskScore: 8,
      auditTrail: [
        { status: 'CREATED', timestamp: new Date(now - 3600000).toISOString(), note: 'Deposit Intent created' },
        { status: 'TRX_SUBMITTED', timestamp: new Date(now - 3560000).toISOString(), note: 'TrxID BL92A81K09 submitted' },
        { status: 'VERIFIED', timestamp: new Date(now - 3550000).toISOString(), note: 'Verified by bKash API' },
        { status: 'CREDITED', timestamp: new Date(now - 3540000).toISOString(), note: 'Double-entry wallet credit' }
      ]
    };
    this.depositIntents.set(sampleDep.id, sampleDep);
    this.consumedTrxIds.set('bkash:BL92A81K09', { depositId: sampleDep.id, userId: 'u_10291', consumedAt: new Date(now - 3540000).toISOString() });

    // Pre-seed sample withdrawal
    const sampleWth: WithdrawalRecord = {
      id: 'WTH-20260821-7B22Z',
      userId: 'u_10291',
      username: 'Tamim_Sultana',
      provider: 'nagad',
      method: 'NAGAD',
      amount: '3000.0000',
      currency: 'BDT',
      recipientAccount: '01844-992200',
      status: 'WITHDRAWAL_COMPLETED',
      reservedBalanceBefore: '0.0000',
      availableBalanceBefore: '8000.0000',
      availableBalanceAfter: '5000.0000',
      providerReference: 'NG_DISB_891028',
      createdAt: new Date(now - 7200000).toISOString(),
      processedAt: new Date(now - 7190000).toISOString(),
      completedAt: new Date(now - 7180000).toISOString(),
      riskScore: 12,
      idempotencyKey: 'WD-REQ-INITIAL-01',
      auditTrail: [
        { status: 'CREATED', timestamp: new Date(now - 7200000).toISOString(), note: 'Withdrawal requested' },
        { status: 'WITHDRAWAL_RESERVED', timestamp: new Date(now - 7200000).toISOString(), note: '৳3,000 reserved' },
        { status: 'WITHDRAWAL_COMPLETED', timestamp: new Date(now - 7180000).toISOString(), note: 'Payout completed via Nagad API' }
      ]
    };
    this.withdrawalRecords.set(sampleWth.id, sampleWth);

    // Pre-seed sample incoming Webhook logs
    this.webhookLogs = [
      {
        id: 'WH_20260822_BK901',
        provider: 'bkash',
        eventType: 'payment.success',
        eventId: 'evt_bk_891029481',
        signature: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        expectedSignature: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        signatureValid: true,
        payload: {
          event: 'payment.success',
          trxID: 'BL92A81K09',
          merchantInvoiceNumber: 'DEP-20260821-9A41K',
          amount: '5000.00',
          currency: 'BDT',
          senderNumber: '01712-349911',
          destinationAccount: '01900-112233',
          transactionStatus: 'Completed',
          paymentExecuteTime: new Date(now - 3550000).toISOString()
        },
        headers: {
          'content-type': 'application/json',
          'x-provider-id': 'bkash',
          'x-signature': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          'x-timestamp': String(now - 3550000),
          'x-webhook-id': 'whk_bk_901'
        },
        httpStatus: 200,
        processed: true,
        processResult: '✅ Signature verified via HMAC-SHA256. Deposit credited to user wallet.',
        latencyMs: 42,
        retryCount: 0,
        createdAt: new Date(now - 3550000).toISOString()
      },
      {
        id: 'WH_20260822_NG804',
        provider: 'nagad',
        eventType: 'payout.disbursed',
        eventId: 'evt_ng_771920194',
        signature: 'f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192',
        expectedSignature: 'f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192',
        signatureValid: true,
        payload: {
          event: 'payout.disbursed',
          issuerTrxId: 'NG_DISB_891028',
          orderId: 'WTH-20260821-7B22Z',
          amount: '3000.00',
          currency: 'BDT',
          recipientAccount: '01844-992200',
          status: 'SUCCESS',
          payoutTime: new Date(now - 7180000).toISOString()
        },
        headers: {
          'content-type': 'application/json',
          'x-provider-id': 'nagad',
          'x-signature': 'f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192',
          'x-timestamp': String(now - 7180000),
          'x-webhook-id': 'whk_ng_804'
        },
        httpStatus: 200,
        processed: true,
        processResult: '✅ Payout confirmation verified. Reserved balance finalized.',
        latencyMs: 38,
        retryCount: 0,
        createdAt: new Date(now - 7180000).toISOString()
      },
      {
        id: 'WH_20260822_PG701',
        provider: 'pgsoft',
        eventType: 'game.round_settled',
        eventId: 'evt_pg_551920841',
        signature: 'a918204810294810293840192834019283401928340192834019283401928340',
        expectedSignature: 'a918204810294810293840192834019283401928340192834019283401928340',
        signatureValid: true,
        payload: {
          event: 'game.round_settled',
          provider: 'pgsoft',
          gameId: 'mahjong-ways-2',
          userId: 'u_10291',
          roundId: 'RND_99210948',
          betAmount: 100,
          winAmount: 450,
          netSettlement: 350,
          currency: 'BDT',
          timestamp: new Date(now - 1200000).toISOString()
        },
        headers: {
          'content-type': 'application/json',
          'x-provider-id': 'pgsoft',
          'x-signature': 'a918204810294810293840192834019283401928340192834019283401928340',
          'x-timestamp': String(now - 1200000),
          'x-webhook-id': 'whk_pg_701'
        },
        httpStatus: 200,
        processed: true,
        processResult: '✅ Game round outcome validated and seamlessly credited.',
        latencyMs: 19,
        retryCount: 0,
        createdAt: new Date(now - 1200000).toISOString()
      },
      {
        id: 'WH_20260822_TAMPER_01',
        provider: 'rocket',
        eventType: 'payment.tampered_attempt',
        eventId: 'evt_rk_bad_sig_9901',
        signature: '0000000000000000000000000000000000000000000000000000000000000000',
        expectedSignature: 'c819283019283019283019283019283019283019283019283019283019283019',
        signatureValid: false,
        payload: {
          event: 'payment.received',
          trxID: 'RK999INVALID99',
          amount: '50000.00',
          currency: 'BDT',
          senderNumber: '01700-000000',
          destinationAccount: '01711-884422-9',
          tamperFlag: 'MAN_IN_THE_MIDDLE_SIMULATION'
        },
        headers: {
          'content-type': 'application/json',
          'x-provider-id': 'rocket',
          'x-signature': '0000000000000000000000000000000000000000000000000000000000000000',
          'x-timestamp': String(now - 600000),
          'x-webhook-id': 'whk_tamper_01'
        },
        httpStatus: 401,
        processed: false,
        processResult: '❌ 401 Unauthorized: Signature hash does not match computed HMAC-SHA256 payload digest.',
        latencyMs: 12,
        retryCount: 0,
        createdAt: new Date(now - 600000).toISOString()
      }
    ];
  }
}

export const paymentGatewayEngine = new PaymentGatewayEngine();
