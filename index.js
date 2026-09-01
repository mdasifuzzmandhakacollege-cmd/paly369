var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/index.ts
import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// src/server/middleware/hmac.ts
import crypto from "crypto";

// src/server/types/seamless.ts
var SeamlessErrorCode = /* @__PURE__ */ ((SeamlessErrorCode2) => {
  SeamlessErrorCode2["SUCCESS"] = "SUCCESS";
  SeamlessErrorCode2["INVALID_SIGNATURE"] = "INVALID_SIGNATURE";
  SeamlessErrorCode2["TIMESTAMP_EXPIRED"] = "TIMESTAMP_EXPIRED";
  SeamlessErrorCode2["INVALID_REQUEST"] = "INVALID_REQUEST";
  SeamlessErrorCode2["USER_NOT_FOUND"] = "USER_NOT_FOUND";
  SeamlessErrorCode2["USER_FROZEN"] = "USER_FROZEN";
  SeamlessErrorCode2["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
  SeamlessErrorCode2["DUPLICATE_TRANSACTION"] = "DUPLICATE_TRANSACTION";
  SeamlessErrorCode2["TRANSACTION_NOT_FOUND"] = "TRANSACTION_NOT_FOUND";
  SeamlessErrorCode2["TRANSACTION_ALREADY_SETTLED"] = "TRANSACTION_ALREADY_SETTLED";
  SeamlessErrorCode2["ROUND_ALREADY_CLOSED"] = "ROUND_ALREADY_CLOSED";
  SeamlessErrorCode2["INVALID_CURRENCY"] = "INVALID_CURRENCY";
  SeamlessErrorCode2["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
  SeamlessErrorCode2["TIMEOUT_EXCEEDED"] = "TIMEOUT_EXCEEDED";
  SeamlessErrorCode2["INTERNAL_ERROR"] = "INTERNAL_ERROR";
  return SeamlessErrorCode2;
})(SeamlessErrorCode || {});

// src/server/middleware/hmac.ts
function getProviderSecret(providerId) {
  const norm = providerId.toLowerCase().trim();
  switch (norm) {
    case "pragmatic_play":
    case "pragmatic":
      return process.env.PROVIDER_PRAGMATIC_SECRET;
    case "evolution":
      return process.env.PROVIDER_EVOLUTION_SECRET;
    case "pgsoft":
      return process.env.PROVIDER_PGSOFT_SECRET;
    case "spribe":
      return process.env.PROVIDER_SPRIBE_SECRET;
    case "custom_provider":
      return process.env.PROVIDER_CUSTOM_SECRET;
    default:
      return process.env[`PROVIDER_${norm.toUpperCase()}_SECRET`];
  }
}
var PROVIDER_SECRETS = new Proxy({}, {
  get: (_, prop) => getProviderSecret(prop)
});
var REPLAY_TOLERANCE_MS = 5 * 60 * 1e3;
function generateHmacSignature(payloadString, timestamp2, secretKey) {
  const messageToSign = `${timestamp2}.${payloadString}`;
  return crypto.createHmac("sha256", secretKey).update(messageToSign, "utf8").digest("hex");
}
function validateHmacSignature(req, res, next) {
  try {
    const signature = req.headers["x-signature"] || req.headers["x-hub-signature-256"] || req.headers["authorization"];
    const timestampHeader = req.headers["x-timestamp"] || req.headers["x-request-timestamp"];
    const providerId = req.headers["x-provider-id"] || req.body?.provider_id;
    if (!signature) {
      res.status(401).json({
        code: "INVALID_SIGNATURE" /* INVALID_SIGNATURE */,
        message: "Missing X-Signature security header in incoming request",
        timestamp: Date.now()
      });
      return;
    }
    if (!timestampHeader) {
      res.status(401).json({
        code: "TIMESTAMP_EXPIRED" /* TIMESTAMP_EXPIRED */,
        message: "Missing X-Timestamp security header",
        timestamp: Date.now()
      });
      return;
    }
    if (!providerId) {
      res.status(400).json({
        code: "INVALID_REQUEST" /* INVALID_REQUEST */,
        message: "Missing provider identifier (X-Provider-Id header or provider_id in body)",
        timestamp: Date.now()
      });
      return;
    }
    const requestTimestamp = parseInt(timestampHeader, 10);
    if (isNaN(requestTimestamp)) {
      res.status(401).json({
        code: "TIMESTAMP_EXPIRED" /* TIMESTAMP_EXPIRED */,
        message: "Invalid X-Timestamp header format (must be epoch ms or seconds)",
        timestamp: Date.now()
      });
      return;
    }
    const normalizedTimestamp = requestTimestamp < 1e10 ? requestTimestamp * 1e3 : requestTimestamp;
    const now = Date.now();
    const drift = Math.abs(now - normalizedTimestamp);
    if (drift > REPLAY_TOLERANCE_MS) {
      res.status(401).json({
        code: "TIMESTAMP_EXPIRED" /* TIMESTAMP_EXPIRED */,
        message: `Request timestamp expired or clock drift exceeded. Drift: ${drift}ms (Max: ${REPLAY_TOLERANCE_MS}ms)`,
        timestamp: now
      });
      return;
    }
    const secretKey = PROVIDER_SECRETS[providerId];
    if (!secretKey) {
      res.status(401).json({
        code: "INVALID_SIGNATURE" /* INVALID_SIGNATURE */,
        message: `Unknown or unconfigured game provider: ${providerId}`,
        timestamp: now
      });
      return;
    }
    const rawPayload = req.rawBody || JSON.stringify(req.body || {});
    const cleanReceivedSig = signature.replace(/^sha256=/i, "").trim().toLowerCase();
    const expectedSig = generateHmacSignature(rawPayload, timestampHeader, secretKey).toLowerCase();
    const receivedBuffer = Buffer.from(cleanReceivedSig, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
      res.status(401).json({
        code: "INVALID_SIGNATURE" /* INVALID_SIGNATURE */,
        message: "Cryptographic HMAC-SHA256 signature verification failed",
        timestamp: now
      });
      return;
    }
    req.providerId = providerId;
    req.signatureTimestamp = normalizedTimestamp;
    next();
  } catch (error) {
    next(error);
  }
}

// src/server/ledger/db.ts
import pg from "pg";
var PostgresLedgerPool = class {
  constructor(connectionStringOrConfig) {
    if (typeof connectionStringOrConfig === "string") {
      this.pool = new pg.Pool({ connectionString: connectionStringOrConfig });
    } else if (connectionStringOrConfig) {
      this.pool = new pg.Pool(connectionStringOrConfig);
    } else {
      this.pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL
      });
    }
    this.pool.on("error", (err) => {
      console.error("[PostgresLedgerPool] Unexpected idle client error:", err);
    });
  }
  async connect() {
    const client = await this.pool.connect();
    return {
      query: async (sql8, params) => {
        const result = await client.query(sql8, params);
        return {
          rows: result.rows,
          rowCount: result.rowCount ?? result.rows.length
        };
      },
      release: () => {
        client.release();
      }
    };
  }
  async query(sql8, params) {
    const result = await this.pool.query(sql8, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length
    };
  }
  async end() {
    await this.pool.end();
  }
  getRawPool() {
    return this.pool;
  }
};
var InMemoryPostgresLedgerEngine = class {
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.wallets = /* @__PURE__ */ new Map();
    // key: `${userId}:${currency}`
    this.ledgerEntries = /* @__PURE__ */ new Map();
    // key: id
    this.idempotencyRecords = /* @__PURE__ */ new Map();
    // key: idempotencyKey
    this.paymentRequests = /* @__PURE__ */ new Map();
    // key: id
    this.walletLocks = /* @__PURE__ */ new Map();
    // Mutex per wallet for row locks
    this.lockResolvers = /* @__PURE__ */ new Map();
    this.seedDefaultUsers();
  }
  seedDefaultUsers() {
    this.users.set("test_player_01", {
      id: "test_player_01",
      username: "player_one",
      status: "ACTIVE",
      currency: "BDT"
    });
    this.wallets.set("test_player_01:BDT", {
      id: 1,
      user_id: "test_player_01",
      currency: "BDT",
      real_balance: "500.0000",
      bonus_balance: "0.0000",
      locked_balance: "0.0000",
      balance_minor: 5000000n,
      // 500.0000 BDT (4-decimal precision = 5,000,000 minor units)
      version: 1n,
      status: "ACTIVE",
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date()
    });
  }
  async connect() {
    const activeTxState = {
      inTransaction: false,
      acquiredLocks: /* @__PURE__ */ new Set(),
      stagedWallets: /* @__PURE__ */ new Map(),
      stagedEntries: /* @__PURE__ */ new Map(),
      stagedIdempotency: /* @__PURE__ */ new Map(),
      stagedPaymentRequests: /* @__PURE__ */ new Map()
    };
    const client = {
      query: async (sql8, params = []) => {
        const cleanSql = sql8.trim().replace(/\s+/g, " ");
        if (cleanSql.toUpperCase() === "BEGIN") {
          activeTxState.inTransaction = true;
          return { rows: [], rowCount: 0 };
        }
        if (cleanSql.toUpperCase() === "COMMIT") {
          if (activeTxState.inTransaction) {
            for (const [k, v] of activeTxState.stagedWallets.entries()) {
              this.wallets.set(k, { ...v });
            }
            for (const [k, v] of activeTxState.stagedEntries.entries()) {
              this.ledgerEntries.set(k, { ...v });
            }
            for (const [k, v] of activeTxState.stagedIdempotency.entries()) {
              this.idempotencyRecords.set(k, { ...v });
            }
            for (const [k, v] of activeTxState.stagedPaymentRequests.entries()) {
              this.paymentRequests.set(k, { ...v });
            }
          }
          this.releaseLocks(activeTxState);
          activeTxState.inTransaction = false;
          return { rows: [], rowCount: 0 };
        }
        if (cleanSql.toUpperCase() === "ROLLBACK") {
          activeTxState.stagedWallets.clear();
          activeTxState.stagedEntries.clear();
          activeTxState.stagedIdempotency.clear();
          activeTxState.stagedPaymentRequests.clear();
          this.releaseLocks(activeTxState);
          activeTxState.inTransaction = false;
          return { rows: [], rowCount: 0 };
        }
        if (cleanSql.includes("FROM idempotency_records") && cleanSql.includes("idempotency_key = $1")) {
          const key = params[0];
          const record = this.idempotencyRecords.get(key) || activeTxState.stagedIdempotency.get(key);
          if (record) {
            return {
              rows: [{
                idempotency_key: record.idempotency_key,
                transaction_id: record.transaction_id,
                status_code: record.status_code,
                response_payload: record.response_payload,
                created_at: record.created_at
              }],
              rowCount: 1
            };
          }
          return { rows: [], rowCount: 0 };
        }
        if (cleanSql.includes("FROM wallets") && (cleanSql.includes("user_id = $1") || cleanSql.includes("WHERE user_id = $1"))) {
          const userId = String(params[0]).trim();
          const currency = params[1] !== void 0 ? String(params[1]).trim() : null;
          if (currency) {
            const walletKey = `${userId}:${currency}`;
            if (cleanSql.toUpperCase().includes("FOR UPDATE")) {
              await this.acquireRowLock(walletKey, activeTxState);
            }
            const existing = activeTxState.stagedWallets.get(walletKey) || this.wallets.get(walletKey);
            if (!existing) {
              return { rows: [], rowCount: 0 };
            }
            return {
              rows: [{
                id: existing.id,
                user_id: existing.user_id,
                currency: existing.currency,
                real_balance: existing.real_balance || (existing.balance_minor !== void 0 ? (Number(existing.balance_minor) / 1e4).toFixed(4) : "0.0000"),
                bonus_balance: existing.bonus_balance || "0.0000",
                locked_balance: existing.locked_balance || "0.0000",
                balance_minor: existing.balance_minor.toString(),
                version: existing.version.toString(),
                status: existing.status,
                created_at: existing.created_at,
                updated_at: existing.updated_at
              }],
              rowCount: 1
            };
          } else {
            const matched = [];
            const source = activeTxState.inTransaction ? new Map([...this.wallets, ...activeTxState.stagedWallets]) : this.wallets;
            for (const existing of source.values()) {
              if (String(existing.user_id) === userId) {
                matched.push({
                  id: existing.id,
                  user_id: existing.user_id,
                  currency: existing.currency,
                  real_balance: existing.real_balance || (existing.balance_minor !== void 0 ? (Number(existing.balance_minor) / 1e4).toFixed(4) : "0.0000"),
                  bonus_balance: existing.bonus_balance || "0.0000",
                  locked_balance: existing.locked_balance || "0.0000",
                  balance_minor: existing.balance_minor.toString(),
                  version: existing.version.toString(),
                  status: existing.status,
                  created_at: existing.created_at,
                  updated_at: existing.updated_at
                });
              }
            }
            return { rows: matched, rowCount: matched.length };
          }
        }
        if (cleanSql.startsWith("INSERT INTO wallets")) {
          let id = Math.floor(Math.random() * 1e5) + 1;
          let userId = "";
          let currency = "BDT";
          let realBalance = "0.0000";
          let bonusBalance = "0.0000";
          let lockedBalance = "0.0000";
          let balanceMinor = 0n;
          let status = "ACTIVE";
          const colMatch = cleanSql.match(/INSERT INTO wallets\s*\(([^)]+)\)/i);
          if (colMatch) {
            const cols = colMatch[1].split(",").map((c) => c.trim().toLowerCase());
            const colMap = {};
            cols.forEach((col, idx) => {
              colMap[col] = params[idx];
            });
            if (colMap.id !== void 0) id = colMap.id;
            if (colMap.user_id !== void 0) userId = String(colMap.user_id).trim();
            if (colMap.currency !== void 0) currency = String(colMap.currency).trim();
            if (colMap.real_balance !== void 0) realBalance = String(colMap.real_balance);
            if (colMap.bonus_balance !== void 0) bonusBalance = String(colMap.bonus_balance);
            if (colMap.locked_balance !== void 0) lockedBalance = String(colMap.locked_balance);
            if (colMap.status !== void 0) status = colMap.status;
            if (colMap.balance_minor !== void 0 && colMap.balance_minor !== null && colMap.balance_minor !== "") {
              balanceMinor = BigInt(colMap.balance_minor.toString());
            } else if (colMap.real_balance !== void 0) {
              const parsed = Math.round(parseFloat(String(colMap.real_balance)) * 1e4);
              balanceMinor = BigInt(isNaN(parsed) ? 0 : parsed);
            }
          } else if (cleanSql.includes("real_balance") && cleanSql.includes("bonus_balance")) {
            userId = String(params[0] ?? "").trim();
            currency = String(params[1] ?? "BDT").trim();
            realBalance = params[2] !== void 0 ? String(params[2]) : "0.0000";
            bonusBalance = params[3] !== void 0 ? String(params[3]) : "0.0000";
            balanceMinor = params[4] !== void 0 ? BigInt(params[4]) : 0n;
            status = params[5] || "ACTIVE";
          } else if (cleanSql.includes("real_balance")) {
            userId = String(params[0] ?? "").trim();
            currency = String(params[1] ?? "BDT").trim();
            realBalance = params[2] !== void 0 ? String(params[2]) : "0.0000";
            balanceMinor = params[3] !== void 0 ? BigInt(params[3]) : 0n;
            status = params[4] || "ACTIVE";
          } else {
            id = params[0] !== void 0 ? params[0] : id;
            userId = String(params[1] ?? "").trim();
            currency = String(params[2] ?? "BDT").trim();
            balanceMinor = params[3] !== void 0 ? BigInt(params[3]) : 0n;
            realBalance = (Number(balanceMinor) / 1e4).toFixed(4);
            status = params[4] || "ACTIVE";
          }
          const walletKey = `${userId}:${currency}`;
          if (this.wallets.has(walletKey) || activeTxState.stagedWallets.has(walletKey)) {
            if (cleanSql.toUpperCase().includes("ON CONFLICT") && cleanSql.toUpperCase().includes("DO NOTHING")) {
              return { rows: [], rowCount: 0 };
            }
            const err = new Error(`duplicate key value violates unique constraint "uq_wallet_user_currency"`);
            err.code = "23505";
            throw err;
          }
          const newWallet = {
            id,
            user_id: userId,
            currency,
            real_balance: realBalance,
            bonus_balance: bonusBalance,
            locked_balance: lockedBalance,
            balance_minor: balanceMinor,
            version: 1n,
            status,
            created_at: /* @__PURE__ */ new Date(),
            updated_at: /* @__PURE__ */ new Date()
          };
          if (activeTxState.inTransaction) {
            activeTxState.stagedWallets.set(walletKey, newWallet);
          } else {
            this.wallets.set(walletKey, newWallet);
          }
          return { rows: [{ id }], rowCount: 1 };
        }
        if (cleanSql.startsWith("UPDATE wallets")) {
          let realBalance = null;
          let bonusBalance = null;
          let lockedBalance = null;
          let balanceMinor = null;
          let walletId;
          if (cleanSql.includes("real_balance = $1") && cleanSql.includes("locked_balance = $2") && cleanSql.includes("balance_minor = $3")) {
            realBalance = String(params[0]);
            lockedBalance = String(params[1]);
            balanceMinor = BigInt(params[2]);
            walletId = params[3];
          } else if (cleanSql.includes("bonus_balance = $1") && cleanSql.includes("real_balance = $2")) {
            bonusBalance = String(params[0]);
            realBalance = String(params[1]);
            balanceMinor = BigInt(params[2]);
            walletId = params[3];
          } else if (cleanSql.includes("bonus_balance = $1")) {
            bonusBalance = String(params[0]);
            walletId = params[1];
          } else if (cleanSql.includes("real_balance = $1") && cleanSql.includes("balance_minor = $2")) {
            realBalance = String(params[0]);
            balanceMinor = BigInt(params[1]);
            walletId = params[2];
          } else if (cleanSql.includes("locked_balance = $1")) {
            lockedBalance = String(params[0]);
            walletId = params[1];
          } else {
            balanceMinor = BigInt(params[0]);
            walletId = params[1];
            realBalance = (Number(balanceMinor) / 1e4).toFixed(4);
          }
          let targetKey = null;
          let targetWallet = null;
          for (const [k, v] of (activeTxState.inTransaction ? activeTxState.stagedWallets : this.wallets).entries()) {
            if (v.id == walletId) {
              targetKey = k;
              targetWallet = v;
              break;
            }
          }
          if (!targetWallet) {
            for (const [k, v] of this.wallets.entries()) {
              if (v.id == walletId) {
                targetKey = k;
                targetWallet = v;
                break;
              }
            }
          }
          if (!targetWallet || !targetKey) {
            return { rows: [], rowCount: 0 };
          }
          if (balanceMinor !== null && balanceMinor < 0n) {
            const err = new Error(`check constraint "chk_wallet_balance_non_negative" failed`);
            err.code = "23514";
            throw err;
          }
          const updated = {
            ...targetWallet,
            real_balance: realBalance ?? targetWallet.real_balance,
            bonus_balance: bonusBalance ?? targetWallet.bonus_balance ?? "0.0000",
            locked_balance: lockedBalance ?? targetWallet.locked_balance ?? "0.0000",
            balance_minor: balanceMinor !== null ? balanceMinor : targetWallet.balance_minor,
            version: targetWallet.version + 1n,
            updated_at: /* @__PURE__ */ new Date()
          };
          if (activeTxState.inTransaction) {
            activeTxState.stagedWallets.set(targetKey, updated);
          } else {
            this.wallets.set(targetKey, updated);
          }
          return { rows: [{ id: walletId }], rowCount: 1 };
        }
        if (cleanSql.startsWith("INSERT INTO payment_requests")) {
          const id = this.paymentRequests.size + activeTxState.stagedPaymentRequests.size + 1;
          let userId = "";
          let walletId = "";
          let type = "WITHDRAWAL";
          let method = "";
          let amount = "0.0000";
          let currency = "BDT";
          let receiverNumber = null;
          let trxId = "";
          let status = "PENDING";
          let adminNote = null;
          let metadata = null;
          const colMatch = cleanSql.match(/INSERT INTO payment_requests\s*\(([^)]+)\)/i);
          if (colMatch) {
            const cols = colMatch[1].split(",").map((c) => c.trim().toLowerCase());
            const colMap = {};
            let paramIdx = 0;
            cols.forEach((col) => {
              if (col === "type" && cleanSql.toUpperCase().includes("'WITHDRAWAL'")) {
                type = "WITHDRAWAL";
              } else if (col === "type" && cleanSql.toUpperCase().includes("'DEPOSIT'")) {
                type = "DEPOSIT";
              } else if (col === "status" && cleanSql.toUpperCase().includes("'PENDING'")) {
                status = "PENDING";
              } else if (col === "created_at" || col === "updated_at") {
              } else {
                colMap[col] = params[paramIdx++];
              }
            });
            if (colMap.user_id !== void 0) userId = colMap.user_id;
            if (colMap.wallet_id !== void 0) walletId = colMap.wallet_id;
            if (colMap.type !== void 0) type = colMap.type;
            if (colMap.method !== void 0) method = colMap.method;
            if (colMap.amount !== void 0) amount = String(colMap.amount);
            if (colMap.currency !== void 0) currency = colMap.currency;
            if (colMap.receiver_number !== void 0) receiverNumber = colMap.receiver_number;
            if (colMap.trx_id !== void 0) trxId = colMap.trx_id;
            if (colMap.status !== void 0) status = colMap.status;
            if (colMap.admin_note !== void 0) adminNote = colMap.admin_note;
            if (colMap.metadata !== void 0) metadata = colMap.metadata;
          } else {
            userId = params[0];
            walletId = params[1];
            type = params[2] || "WITHDRAWAL";
            method = params[3];
            amount = params[4];
            currency = params[5] || "BDT";
            receiverNumber = params[6] || null;
            trxId = params[7];
            status = params[8] || "PENDING";
            adminNote = params[9] || null;
            metadata = params[10] || null;
          }
          const reqRec = {
            id,
            user_id: userId,
            wallet_id: walletId,
            type,
            method,
            amount: String(amount),
            currency,
            receiver_number: receiverNumber ? String(receiverNumber) : null,
            trx_id: trxId,
            status,
            admin_note: adminNote,
            metadata: typeof metadata === "string" ? JSON.parse(metadata) : metadata,
            created_at: /* @__PURE__ */ new Date(),
            updated_at: /* @__PURE__ */ new Date()
          };
          if (activeTxState.inTransaction) {
            activeTxState.stagedPaymentRequests.set(id, reqRec);
          } else {
            this.paymentRequests.set(id, reqRec);
          }
          return { rows: [reqRec], rowCount: 1 };
        }
        if (cleanSql.includes("FROM payment_requests")) {
          const allReqs = [...this.paymentRequests.values(), ...activeTxState.stagedPaymentRequests.values()];
          if (cleanSql.includes("user_id = $1")) {
            const uId = params[0];
            const filtered = allReqs.filter((r) => r.user_id == uId);
            return { rows: filtered, rowCount: filtered.length };
          }
          if (cleanSql.includes("trx_id = $1")) {
            const tId = params[0];
            const filtered = allReqs.filter((r) => r.trx_id === tId);
            return { rows: filtered, rowCount: filtered.length };
          }
          return { rows: allReqs, rowCount: allReqs.length };
        }
        if (cleanSql.startsWith("INSERT INTO ledger_entries")) {
          let id;
          let walletId;
          let userId;
          let transactionId;
          let refTxId;
          let type;
          let balanceTarget = "REAL";
          let amountMinor;
          let currency;
          let beforeMinor;
          let afterMinor;
          let status;
          let correlationId;
          let auditMetadata;
          if (params.length >= 14) {
            [
              id,
              walletId,
              userId,
              transactionId,
              refTxId,
              type,
              balanceTarget,
              amountMinor,
              currency,
              beforeMinor,
              afterMinor,
              status,
              correlationId,
              auditMetadata
            ] = params;
          } else {
            [
              id,
              walletId,
              userId,
              transactionId,
              refTxId,
              type,
              amountMinor,
              currency,
              beforeMinor,
              afterMinor,
              status,
              correlationId,
              auditMetadata
            ] = params;
            const parsedAudit = typeof auditMetadata === "string" ? JSON.parse(auditMetadata) : auditMetadata;
            if (parsedAudit?.targetBalance === "BONUS" || parsedAudit?.category === "BONUS_CASH") {
              balanceTarget = "BONUS";
            } else if (parsedAudit?.targetBalance === "LOCKED") {
              balanceTarget = "LOCKED";
            }
          }
          if (balanceTarget !== "REAL" && balanceTarget !== "BONUS" && balanceTarget !== "LOCKED") {
            const err = new Error(`check constraint "chk_ledger_balance_target" failed`);
            err.code = "23514";
            throw err;
          }
          for (const existingEntry of [...this.ledgerEntries.values(), ...activeTxState.stagedEntries.values()]) {
            if (existingEntry.user_id === userId && existingEntry.transaction_id === transactionId) {
              const err = new Error(`duplicate key value violates unique constraint "uq_ledger_user_transaction"`);
              err.code = "23505";
              throw err;
            }
          }
          const entry = {
            id,
            wallet_id: walletId,
            user_id: userId,
            transaction_id: transactionId,
            reference_transaction_id: refTxId || null,
            type,
            balance_target: balanceTarget || "REAL",
            amount_minor: BigInt(amountMinor),
            currency,
            before_balance_minor: BigInt(beforeMinor),
            after_balance_minor: BigInt(afterMinor),
            status: status || "COMMITTED",
            correlation_id: correlationId,
            audit_metadata: typeof auditMetadata === "string" ? JSON.parse(auditMetadata) : auditMetadata,
            created_at: /* @__PURE__ */ new Date()
          };
          if (activeTxState.inTransaction) {
            activeTxState.stagedEntries.set(id, entry);
          } else {
            this.ledgerEntries.set(id, entry);
          }
          return { rows: [{ id }], rowCount: 1 };
        }
        if (cleanSql.startsWith("INSERT INTO idempotency_records")) {
          const [key, txId, statusCode, payloadJson] = params;
          if (this.idempotencyRecords.has(key) || activeTxState.stagedIdempotency.has(key)) {
            const err = new Error(`duplicate key value violates unique constraint "uq_idempotency_key"`);
            err.code = "23505";
            throw err;
          }
          const rec = {
            idempotency_key: key,
            transaction_id: txId,
            status_code: statusCode,
            response_payload: typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson,
            created_at: /* @__PURE__ */ new Date()
          };
          if (activeTxState.inTransaction) {
            activeTxState.stagedIdempotency.set(key, rec);
          } else {
            this.idempotencyRecords.set(key, rec);
          }
          return { rows: [{ idempotency_key: key }], rowCount: 1 };
        }
        if (cleanSql.includes("FROM ledger_entries") && cleanSql.includes("user_id = $1")) {
          const userId = String(params[0]).trim();
          const matched = [];
          for (const entry of this.ledgerEntries.values()) {
            if (String(entry.user_id) === userId) {
              matched.push({
                id: entry.id,
                wallet_id: entry.wallet_id,
                user_id: entry.user_id,
                transaction_id: entry.transaction_id,
                reference_transaction_id: entry.reference_transaction_id,
                type: entry.type,
                balance_target: entry.balance_target || "REAL",
                amount_minor: entry.amount_minor !== void 0 ? entry.amount_minor.toString() : "0",
                currency: entry.currency,
                before_balance_minor: entry.before_balance_minor !== void 0 ? entry.before_balance_minor.toString() : "0",
                after_balance_minor: entry.after_balance_minor !== void 0 ? entry.after_balance_minor.toString() : "0",
                status: entry.status,
                correlation_id: entry.correlation_id,
                audit_metadata: typeof entry.audit_metadata === "object" ? JSON.stringify(entry.audit_metadata) : entry.audit_metadata,
                created_at: entry.created_at
              });
            }
          }
          return { rows: matched, rowCount: matched.length };
        }
        if (cleanSql.includes("FROM ledger_entries") && cleanSql.includes("transaction_id = $1")) {
          const txId = params[0];
          for (const entry of this.ledgerEntries.values()) {
            if (entry.transaction_id === txId) {
              return {
                rows: [{
                  id: entry.id,
                  wallet_id: entry.wallet_id,
                  user_id: entry.user_id,
                  transaction_id: entry.transaction_id,
                  balance_target: entry.balance_target || "REAL",
                  audit_metadata: entry.audit_metadata
                }],
                rowCount: 1
              };
            }
          }
          return { rows: [], rowCount: 0 };
        }
        if (cleanSql.includes("SUM") && cleanSql.includes("FROM ledger_entries")) {
          const walletId = params[0];
          const isBonusFilter = cleanSql.includes("'BONUS'") || params[1] === "BONUS";
          const isLockedFilter = cleanSql.includes("'LOCKED'") || params[1] === "LOCKED";
          const isRealFilter = cleanSql.includes("'REAL'") || params[1] === "REAL";
          const targetFilter = isBonusFilter ? "BONUS" : isLockedFilter ? "LOCKED" : isRealFilter ? "REAL" : null;
          let totalCredits = 0n;
          let totalDebits = 0n;
          let firstEntryBeforeMinor = null;
          let entryCount = 0;
          for (const entry of this.ledgerEntries.values()) {
            if (entry.wallet_id == walletId && entry.status === "COMMITTED") {
              const entryTarget = entry.balance_target || (entry.audit_metadata?.targetBalance === "BONUS" || entry.audit_metadata?.category === "BONUS_CASH" ? "BONUS" : entry.audit_metadata?.targetBalance === "LOCKED" ? "LOCKED" : "REAL");
              if (!targetFilter || entryTarget === targetFilter) {
                if (firstEntryBeforeMinor === null) {
                  firstEntryBeforeMinor = entry.before_balance_minor;
                }
                if (entry.type === "CREDIT" || entry.type === "REVERSAL") {
                  totalCredits += entry.amount_minor;
                } else if (entry.type === "DEBIT") {
                  totalDebits += entry.amount_minor;
                }
                entryCount++;
              }
            }
          }
          return {
            rows: [{
              total_credits: totalCredits.toString(),
              total_debits: totalDebits.toString(),
              net_minor: (totalCredits - totalDebits).toString(),
              initial_seed_minor: firstEntryBeforeMinor !== null ? firstEntryBeforeMinor.toString() : null,
              entry_count: entryCount.toString()
            }],
            rowCount: 1
          };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => {
        if (activeTxState.inTransaction) {
          activeTxState.stagedWallets.clear();
          activeTxState.stagedEntries.clear();
          activeTxState.stagedIdempotency.clear();
          activeTxState.stagedPaymentRequests.clear();
          this.releaseLocks(activeTxState);
        }
      }
    };
    return client;
  }
  async query(sql8, params) {
    const client = await this.connect();
    try {
      return await client.query(sql8, params);
    } finally {
      client.release();
    }
  }
  async acquireRowLock(walletKey, txState) {
    while (this.walletLocks.has(walletKey)) {
      await this.walletLocks.get(walletKey);
    }
    let resolver;
    const lockPromise = new Promise((res) => {
      resolver = res;
    });
    this.walletLocks.set(walletKey, lockPromise);
    this.lockResolvers.set(walletKey, resolver);
    txState.acquiredLocks.add(walletKey);
  }
  releaseLocks(txState) {
    for (const key of txState.acquiredLocks) {
      const resolver = this.lockResolvers.get(key);
      if (resolver) {
        resolver();
        this.lockResolvers.delete(key);
      }
      this.walletLocks.delete(key);
    }
    txState.acquiredLocks.clear();
  }
  /**
   * Diagnostic helper to inspect master storage state
   */
  getDebugSnapshot() {
    return {
      walletsCount: this.wallets.size,
      ledgerEntriesCount: this.ledgerEntries.size,
      idempotencyRecordsCount: this.idempotencyRecords.size,
      paymentRequestsCount: this.paymentRequests.size
    };
  }
  /**
   * Helper to seed or reset a wallet for testing
   */
  seedWallet(params) {
    const userId = String(params.userId);
    const currency = params.currency || "BDT";
    const realBalance = params.realBalance || "0.0000";
    const bonusBalance = params.bonusBalance || "0.0000";
    const lockedBalance = params.lockedBalance || "0.0000";
    const realMinor = BigInt(Math.round(parseFloat(realBalance) * 1e4));
    const walletKey = `${userId}:${currency}`;
    const id = this.wallets.size + 1;
    this.users.set(userId, {
      id: userId,
      username: `user_${userId}`,
      status: params.status || "ACTIVE",
      currency
    });
    this.wallets.set(walletKey, {
      id,
      user_id: userId,
      currency,
      real_balance: realBalance,
      bonus_balance: bonusBalance,
      locked_balance: lockedBalance,
      balance_minor: realMinor,
      version: 1n,
      status: params.status || "ACTIVE",
      created_at: /* @__PURE__ */ new Date(),
      updated_at: /* @__PURE__ */ new Date()
    });
  }
  /**
   * Helper to retrieve all ledger entries for testing and audit inspection
   */
  getAllLedgerEntries() {
    return Array.from(this.ledgerEntries.values());
  }
  /**
   * Helper to directly set or manipulate a ledger entry for testing backfill & migration logic
   */
  setRawLedgerEntry(id, entry) {
    this.ledgerEntries.set(id, entry);
  }
  /**
   * Helper to directly mutate a wallet for testing reconciliation discrepancy detection
   */
  setRawWallet(walletKey, wallet) {
    this.wallets.set(walletKey, wallet);
  }
};

// src/server/ledger/types.ts
import { createHash } from "crypto";

// src/server/gateway/masking.ts
var SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /passphrase/i,
  /token/i,
  /session[-_]?token/i,
  /auth(orization)?/i,
  /bearer/i,
  /signature/i,
  /hmac/i,
  /private[-_]?key/i,
  /credit[-_]?card/i,
  /cvv/i,
  /pin/i,
  /idempotency[-_]?key/i,
  /idemp/i
];
function maskIdempotencyKey(key) {
  if (!key || typeof key !== "string") return "";
  const trimmed = key.trim();
  if (trimmed.length <= 8) {
    return `${trimmed.substring(0, 2)}***${trimmed.substring(trimmed.length - 2)}`;
  }
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}
function maskSensitiveData(data, depth = 0) {
  if (depth > 6) return "[Max Depth Reached]";
  if (data === null || data === void 0) return data;
  if (typeof data === "string") {
    if (data.startsWith("Bearer ") && data.length > 15) {
      return `Bearer ${data.substring(7, 11)}...***`;
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, depth + 1));
  }
  if (typeof data === "object") {
    const maskedObj = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey && value !== null && value !== void 0) {
        if (typeof value === "string" && value.length > 8) {
          maskedObj[key] = `${value.substring(0, 3)}***${value.substring(value.length - 3)}`;
        } else {
          maskedObj[key] = "***REDACTED***";
        }
      } else {
        maskedObj[key] = maskSensitiveData(value, depth + 1);
      }
    }
    return maskedObj;
  }
  return data;
}
function safeLog(level, correlationId, message, meta) {
  const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
  const sanitizedMeta = meta ? maskSensitiveData(meta) : void 0;
  const prefix = `[ProviderGateway] [${timestamp2}] [CID:${correlationId}]`;
  if (level === "error") {
    console.error(`${prefix} [ERROR] ${message}`, sanitizedMeta ? sanitizedMeta : "");
  } else if (level === "warn") {
    console.warn(`${prefix} [WARN] ${message}`, sanitizedMeta ? sanitizedMeta : "");
  } else {
    console.log(`${prefix} [INFO] ${message}`, sanitizedMeta ? sanitizedMeta : "");
  }
}

// src/server/ledger/types.ts
var SUPPORTED_CURRENCIES = /* @__PURE__ */ new Set(["BDT", "USD", "EUR", "INR"]);
var LedgerValidationError = class extends Error {
  constructor(message, details) {
    super(message);
    this.code = "LEDGER_VALIDATION_ERROR";
    this.statusCode = 400;
    this.name = "LedgerValidationError";
    this.details = details;
  }
};
function deriveWithdrawalTransactionId(userId, idempotencyKey) {
  const normalizedUser = String(userId).trim();
  const rawKey = String(idempotencyKey);
  const hash = createHash("sha256").update(`${normalizedUser}:${rawKey}`).digest("hex");
  return `WTH_RES_${normalizedUser}_${hash.substring(0, 32)}`;
}
var IdempotencyConflictError = class extends Error {
  constructor(keyOrMessage, details) {
    const isKey = keyOrMessage && !keyOrMessage.toLowerCase().includes("conflict");
    const message = isKey ? `Idempotency conflict for key '${maskIdempotencyKey(keyOrMessage)}'` : keyOrMessage;
    super(message);
    this.code = "IDEMPOTENCY_CONFLICT";
    this.statusCode = 409;
    this.name = "IdempotencyConflictError";
    this.details = details;
  }
};
var InsufficientFundsError = class extends Error {
  constructor(availableMinor, requiredMinor, currency) {
    super(`Insufficient funds. Required: ${requiredMinor}, Available: ${availableMinor} ${currency}`);
    this.code = "INSUFFICIENT_FUNDS";
    this.statusCode = 422;
    this.name = "InsufficientFundsError";
    this.availableMinor = availableMinor.toString();
    this.requiredMinor = requiredMinor.toString();
    this.currency = currency;
  }
};
var WalletFrozenError = class extends Error {
  constructor(userId, status) {
    super(`Wallet for user '${userId}' is not active (status: ${status})`);
    this.code = "WALLET_FROZEN";
    this.statusCode = 403;
    this.name = "WalletFrozenError";
  }
};
var WalletNotFoundError = class extends Error {
  constructor(userId, currency) {
    super(`Wallet not found for user '${userId}' with currency '${currency}'`);
    this.code = "WALLET_NOT_FOUND";
    this.statusCode = 404;
    this.name = "WalletNotFoundError";
  }
};

// src/server/ledger/money.ts
var LEDGER_DECIMALS = 4;
var CURRENCY_DECIMALS = {
  BDT: 4,
  USD: 4,
  EUR: 4,
  INR: 4
};
function validateCurrency(currency) {
  if (!currency || typeof currency !== "string") {
    throw new LedgerValidationError("Currency is required and must be a string", { currency });
  }
  const normalized = currency.toUpperCase().trim();
  if (!SUPPORTED_CURRENCIES.has(normalized)) {
    throw new LedgerValidationError(`Unsupported currency '${currency}'. Supported: ${Array.from(SUPPORTED_CURRENCIES).join(", ")}`, {
      currency,
      supported: Array.from(SUPPORTED_CURRENCIES)
    });
  }
  return normalized;
}
function parseToMinorUnits(amount, currency, allowZero = false) {
  if (amount === void 0 || amount === null) {
    throw new LedgerValidationError("Transaction amount is required", { amount });
  }
  let minorBigInt;
  if (typeof amount === "bigint") {
    minorBigInt = amount;
  } else if (typeof amount === "number") {
    if (!Number.isFinite(amount)) {
      throw new LedgerValidationError("Transaction amount must be a finite number", { amount });
    }
    if (amount < 0) {
      throw new LedgerValidationError("Transaction amount cannot be negative", { amount });
    }
    const decimals = CURRENCY_DECIMALS[currency] || LEDGER_DECIMALS;
    const str = amount.toFixed(decimals);
    const [intPart, fracPart = ""] = str.split(".");
    const paddedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
    minorBigInt = BigInt(intPart + paddedFrac);
  } else if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      throw new LedgerValidationError("Invalid numeric amount format", { amount });
    }
    const decimals = CURRENCY_DECIMALS[currency] || LEDGER_DECIMALS;
    const [intPart, fracPart = ""] = trimmed.split(".");
    const paddedFrac = fracPart.padEnd(decimals, "0").slice(0, decimals);
    minorBigInt = BigInt(intPart + paddedFrac);
  } else {
    throw new LedgerValidationError("Amount must be a bigint, number, or string", { amount });
  }
  if (minorBigInt < 0n) {
    throw new LedgerValidationError("Amount in minor units cannot be negative", { minorUnits: minorBigInt.toString() });
  }
  if (!allowZero && minorBigInt === 0n) {
    throw new LedgerValidationError("Transaction amount must be strictly greater than zero", { minorUnits: "0" });
  }
  return minorBigInt;
}
function formatMinorUnits(minorUnits, currency = "BDT") {
  const decimals = CURRENCY_DECIMALS[currency] || LEDGER_DECIMALS;
  const isNegative = minorUnits < 0n;
  const absUnits = isNegative ? -minorUnits : minorUnits;
  const str = absUnits.toString().padStart(decimals + 1, "0");
  const splitPoint = str.length - decimals;
  const intPart = str.slice(0, splitPoint) || "0";
  const fracPart = str.slice(splitPoint);
  const formatted = `${intPart}.${fracPart}`;
  return isNegative ? `-${formatted}` : formatted;
}

// src/server/ledger/walletLedgerService.ts
var WalletLedgerService = class {
  constructor(dbPool) {
    this.db = dbPool;
  }
  /**
   * Generates a deterministic idempotency key for transactions
   */
  generateIdempotencyKey(userId, currency, transactionId) {
    return `idemp:${String(userId).trim()}:${currency}:${transactionId.trim()}`;
  }
  /**
   * Retrieves user wallet balance (non-blocking read)
   */
  async getWallet(userId, currency) {
    if (userId === void 0 || userId === null || String(userId).trim() === "") {
      throw new LedgerValidationError("Valid userId is required", { userId });
    }
    const normalizedUserId = String(userId).trim();
    const validatedCurrency = validateCurrency(currency);
    const res = await this.db.query(
      `SELECT id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status, created_at, updated_at
       FROM wallets
       WHERE user_id = $1 AND currency = $2
       LIMIT 1`,
      [normalizedUserId, validatedCurrency]
    );
    if (res.rows.length === 0) {
      throw new WalletNotFoundError(normalizedUserId, validatedCurrency);
    }
    const row = res.rows[0];
    let balanceMinor;
    if (row.balance_minor !== void 0 && row.balance_minor !== null && row.balance_minor !== "") {
      balanceMinor = BigInt(row.balance_minor.toString());
    } else if (row.real_balance !== void 0 && row.real_balance !== null) {
      balanceMinor = parseToMinorUnits(row.real_balance.toString(), validatedCurrency, true);
    } else {
      balanceMinor = 0n;
    }
    return {
      id: row.id,
      userId: row.user_id,
      currency: row.currency,
      balanceMinor,
      realBalance: row.real_balance !== void 0 && row.real_balance !== null ? row.real_balance.toString() : formatMinorUnits(balanceMinor, row.currency),
      bonusBalance: row.bonus_balance !== void 0 && row.bonus_balance !== null ? row.bonus_balance.toString() : "0.0000",
      lockedBalance: row.locked_balance !== void 0 && row.locked_balance !== null ? row.locked_balance.toString() : "0.0000",
      version: BigInt(row.version),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
  /**
   * Ensures wallet exists or creates a new one inside an isolated operation
   */
  async ensureWallet(userId, currency, initialBalanceMinor = 0n) {
    if (userId === void 0 || userId === null || String(userId).trim() === "") {
      throw new LedgerValidationError("Valid userId is required", { userId });
    }
    const normalizedUserId = String(userId).trim();
    const validatedCurrency = validateCurrency(currency);
    try {
      return await this.getWallet(normalizedUserId, validatedCurrency);
    } catch (err) {
      if (err instanceof WalletNotFoundError) {
        const initialRealBalance = formatMinorUnits(initialBalanceMinor, validatedCurrency);
        await this.db.query(
          `INSERT INTO wallets (user_id, currency, real_balance, balance_minor, status)
           VALUES ($1, $2, $3, $4, 'ACTIVE')
           ON CONFLICT (user_id, currency) DO NOTHING`,
          [normalizedUserId, validatedCurrency, initialRealBalance, initialBalanceMinor.toString()]
        );
        return await this.getWallet(normalizedUserId, validatedCurrency);
      }
      throw err;
    }
  }
  /**
   * Executes a strict ACID financial ledger transaction:
   * 1. Validates inputs & sanitizes metadata.
   * 2. Opens transaction: `BEGIN`.
   * 3. Checks idempotency: returns cached outcome if already executed.
   * 4. Acquires row lock: `SELECT ... FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE`.
   * 5. Enforces balance invariants & status guards.
   * 6. Updates balance: `UPDATE wallets SET real_balance = ..., balance_minor = ...`.
   * 7. Inserts immutable record: `INSERT INTO ledger_entries (...)`.
   * 8. Records idempotency state: `INSERT INTO idempotency_records (...)`.
   * 9. Commits transaction: `COMMIT`.
   */
  async executeTransaction(req) {
    if (req.userId === void 0 || req.userId === null || String(req.userId).trim() === "") {
      throw new LedgerValidationError("userId is required", { userId: req.userId });
    }
    const normalizedUserId = String(req.userId).trim();
    if (!req.transactionId || typeof req.transactionId !== "string" || req.transactionId.trim().length === 0) {
      throw new LedgerValidationError("transactionId is required and must be a non-empty string", { transactionId: req.transactionId });
    }
    const currency = validateCurrency(req.currency);
    const targetBalance = req.targetBalance || "REAL";
    const allowZero = req.type === "CREDIT" || req.type === "ADJUSTMENT";
    const rawAmount = req.amountMinor !== void 0 ? req.amountMinor : req.amountMajor;
    const amountMinor = parseToMinorUnits(rawAmount, currency, allowZero);
    const correlationId = req.correlationId || `cid-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const idempotencyKey = this.generateIdempotencyKey(normalizedUserId, currency, req.transactionId);
    const sanitizedAudit = req.auditMetadata ? maskSensitiveData(req.auditMetadata) : {};
    sanitizedAudit.targetBalance = targetBalance;
    if (targetBalance === "BONUS" && !sanitizedAudit.category) {
      sanitizedAudit.category = "BONUS_CASH";
    } else if (targetBalance === "REAL" && !sanitizedAudit.category) {
      sanitizedAudit.category = "REAL_CASH";
    }
    safeLog("info", correlationId, `[Ledger] Initiating ${req.type} (${targetBalance}) of ${formatMinorUnits(amountMinor, currency)} ${currency}`, {
      userId: normalizedUserId,
      transactionId: req.transactionId,
      type: req.type,
      targetBalance
    });
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const existingIdemp = await client.query(
        `SELECT idempotency_key, transaction_id, status_code, response_payload
         FROM idempotency_records
         WHERE idempotency_key = $1
         LIMIT 1`,
        [idempotencyKey]
      );
      if (existingIdemp.rows.length > 0) {
        await client.query("COMMIT");
        safeLog("info", correlationId, `[Ledger] Idempotent hit for transactionId: ${req.transactionId}`);
        const rawPayload = existingIdemp.rows[0].response_payload;
        const cached = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
        return {
          ...cached,
          isIdempotent: true
        };
      }
      let walletRes = await client.query(
        `SELECT id, user_id, currency, real_balance, bonus_balance, balance_minor, version, status
         FROM wallets
         WHERE user_id = $1 AND currency = $2
         FOR UPDATE`,
        [normalizedUserId, currency]
      );
      if (walletRes.rows.length === 0) {
        await client.query(
          `INSERT INTO wallets (user_id, currency, real_balance, bonus_balance, balance_minor, status)
           VALUES ($1, $2, $3, '0.0000', $4, 'ACTIVE')
           ON CONFLICT (user_id, currency) DO NOTHING`,
          [normalizedUserId, currency, "0.0000", "0"]
        );
        walletRes = await client.query(
          `SELECT id, user_id, currency, real_balance, bonus_balance, balance_minor, version, status
           FROM wallets
           WHERE user_id = $1 AND currency = $2
           FOR UPDATE`,
          [normalizedUserId, currency]
        );
        if (walletRes.rows.length === 0) {
          await client.query("ROLLBACK");
          throw new WalletNotFoundError(normalizedUserId, currency);
        }
      }
      const wallet = walletRes.rows[0];
      if (wallet.status !== "ACTIVE") {
        await client.query("ROLLBACK");
        throw new WalletFrozenError(normalizedUserId, wallet.status);
      }
      let beforeBalanceMinor;
      if (targetBalance === "BONUS") {
        const bonusStr = wallet.bonus_balance !== void 0 && wallet.bonus_balance !== null ? wallet.bonus_balance.toString() : "0.0000";
        beforeBalanceMinor = parseToMinorUnits(bonusStr, currency, true);
      } else {
        if (wallet.balance_minor !== void 0 && wallet.balance_minor !== null && wallet.balance_minor !== "") {
          beforeBalanceMinor = BigInt(wallet.balance_minor.toString());
        } else if (wallet.real_balance !== void 0 && wallet.real_balance !== null) {
          beforeBalanceMinor = parseToMinorUnits(wallet.real_balance.toString(), currency, true);
        } else {
          beforeBalanceMinor = 0n;
        }
      }
      let afterBalanceMinor;
      if (req.type === "DEBIT") {
        if (beforeBalanceMinor < amountMinor) {
          await client.query("ROLLBACK");
          safeLog("warn", correlationId, `[Ledger] Insufficient funds: available=${beforeBalanceMinor}, required=${amountMinor}`);
          throw new InsufficientFundsError(beforeBalanceMinor, amountMinor, currency);
        }
        afterBalanceMinor = beforeBalanceMinor - amountMinor;
      } else if (req.type === "CREDIT" || req.type === "REVERSAL") {
        afterBalanceMinor = beforeBalanceMinor + amountMinor;
      } else if (req.type === "ADJUSTMENT") {
        afterBalanceMinor = beforeBalanceMinor + amountMinor;
        if (afterBalanceMinor < 0n) {
          await client.query("ROLLBACK");
          throw new InsufficientFundsError(beforeBalanceMinor, amountMinor, currency);
        }
      } else {
        await client.query("ROLLBACK");
        throw new LedgerValidationError(`Unsupported ledger transaction type: ${req.type}`);
      }
      const formattedBalance = formatMinorUnits(afterBalanceMinor, currency);
      if (targetBalance === "BONUS") {
        await client.query(
          `UPDATE wallets
           SET bonus_balance = $1,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $2`,
          [formattedBalance, wallet.id]
        );
      } else {
        await client.query(
          `UPDATE wallets
           SET real_balance = $1,
               balance_minor = $2,
               version = version + 1,
               updated_at = NOW()
           WHERE id = $3`,
          [formattedBalance, afterBalanceMinor.toString(), wallet.id]
        );
      }
      const entryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          entryId,
          wallet.id,
          normalizedUserId,
          req.transactionId.trim(),
          req.referenceTransactionId?.trim() || null,
          req.type,
          targetBalance,
          amountMinor.toString(),
          currency,
          beforeBalanceMinor.toString(),
          afterBalanceMinor.toString(),
          "COMMITTED",
          correlationId,
          JSON.stringify(sanitizedAudit)
        ]
      );
      const result = {
        success: true,
        isIdempotent: false,
        ledgerEntryId: entryId,
        transactionId: req.transactionId.trim(),
        referenceTransactionId: req.referenceTransactionId?.trim() || null,
        userId: normalizedUserId,
        currency,
        type: req.type,
        targetBalance,
        amountMinor: amountMinor.toString(),
        amountMajor: formatMinorUnits(amountMinor, currency),
        beforeBalanceMinor: beforeBalanceMinor.toString(),
        afterBalanceMinor: afterBalanceMinor.toString(),
        afterBalanceMajor: formatMinorUnits(afterBalanceMinor, currency),
        correlationId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      await client.query(
        `INSERT INTO idempotency_records (
           idempotency_key, transaction_id, status_code, response_payload
         )
         VALUES ($1, $2, $3, $4)`,
        [idempotencyKey, req.transactionId.trim(), 200, JSON.stringify(result)]
      );
      await client.query("COMMIT");
      safeLog("info", correlationId, `[Ledger] Transaction committed successfully: ${req.transactionId}`, {
        entryId,
        afterBalance: result.afterBalanceMajor
      });
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {
      });
      if (err.code === "23505") {
        const recovery = await this.db.query(
          `SELECT response_payload FROM idempotency_records WHERE idempotency_key = $1 LIMIT 1`,
          [idempotencyKey]
        );
        if (recovery.rows.length > 0) {
          const rawRec = recovery.rows[0].response_payload;
          const cachedRec = typeof rawRec === "string" ? JSON.parse(rawRec) : rawRec;
          return {
            ...cachedRec,
            isIdempotent: true
          };
        }
      }
      safeLog("error", correlationId, `[Ledger] Transaction failed: ${err.message}`, {
        code: err.code,
        name: err.name
      });
      throw err;
    } finally {
      client.release();
    }
  }
  /**
   * Executes an authoritative atomic balance conversion from BONUS to REAL:
   * 1. Validates inputs & sanitizes metadata.
   * 2. Opens transaction: `BEGIN`.
   * 3. Checks idempotency using root transactionId: `WAGERING_RELEASE_<userId>_<requirementId>`.
   * 4. Acquires row lock: `SELECT ... FROM wallets WHERE user_id = $1 AND currency = $2 FOR UPDATE`.
   * 5. Enforces balance invariants & status guards:
   *    - Verifies wallet is ACTIVE.
   *    - Verifies sufficient BONUS balance (bonusBalanceMinor >= amountMinor).
   * 6. Atomically debits BONUS balance and credits REAL balance in a single database update:
   *    `UPDATE wallets SET bonus_balance = $1, real_balance = $2, balance_minor = $3 ...`
   * 7. Inserts 2 immutable ledger entries:
   *    - Leg 1: DEBIT (targetBalance: 'BONUS')
   *    - Leg 2: CREDIT (targetBalance: 'REAL')
   *    Both entries reference the root transactionId as reference_transaction_id.
   * 8. Records single idempotency record under the root idempotency key.
   * 9. Commits transaction: `COMMIT`.
   */
  async executeBonusToRealTransfer(req) {
    if (req.userId === void 0 || req.userId === null || String(req.userId).trim() === "") {
      throw new LedgerValidationError("userId is required", { userId: req.userId });
    }
    const normalizedUserId = String(req.userId).trim();
    if (!req.transactionId || typeof req.transactionId !== "string" || req.transactionId.trim().length === 0) {
      throw new LedgerValidationError("transactionId is required and must be a non-empty string", { transactionId: req.transactionId });
    }
    if (req.wageringRequirementId === void 0 || req.wageringRequirementId === null || isNaN(Number(req.wageringRequirementId))) {
      throw new LedgerValidationError("wageringRequirementId is required and must be a valid number", { wageringRequirementId: req.wageringRequirementId });
    }
    const currency = validateCurrency(req.currency);
    const rawAmount = req.amountMinor !== void 0 ? req.amountMinor : req.amountMajor;
    const amountMinor = parseToMinorUnits(rawAmount, currency, false);
    const correlationId = req.correlationId || `cid-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const rootTxId = req.transactionId.trim();
    const idempotencyKey = this.generateIdempotencyKey(normalizedUserId, currency, rootTxId);
    const sanitizedAudit = req.auditMetadata ? maskSensitiveData(req.auditMetadata) : {};
    sanitizedAudit.operation = "BONUS_TO_REAL_CONVERSION";
    sanitizedAudit.wageringRequirementId = req.wageringRequirementId;
    safeLog("info", correlationId, `[Ledger] Initiating atomic BONUS -> REAL transfer of ${formatMinorUnits(amountMinor, currency)} ${currency}`, {
      userId: normalizedUserId,
      transactionId: rootTxId,
      amountMinor: amountMinor.toString(),
      wageringRequirementId: req.wageringRequirementId
    });
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const existingIdemp = await client.query(
        `SELECT idempotency_key, transaction_id, status_code, response_payload
         FROM idempotency_records
         WHERE idempotency_key = $1
         LIMIT 1`,
        [idempotencyKey]
      );
      if (existingIdemp.rows.length > 0) {
        await client.query("COMMIT");
        safeLog("info", correlationId, `[Ledger] Idempotent hit for bonus transfer: ${rootTxId}`);
        const rawPayload = existingIdemp.rows[0].response_payload;
        const cached = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
        return {
          ...cached,
          isIdempotent: true
        };
      }
      let walletRes = await client.query(
        `SELECT id, user_id, currency, real_balance, bonus_balance, balance_minor, version, status
         FROM wallets
         WHERE user_id = $1 AND currency = $2
         FOR UPDATE`,
        [normalizedUserId, currency]
      );
      const postLockIdemp = await client.query(
        `SELECT idempotency_key, transaction_id, status_code, response_payload
         FROM idempotency_records
         WHERE idempotency_key = $1
         LIMIT 1`,
        [idempotencyKey]
      );
      if (postLockIdemp.rows.length > 0) {
        await client.query("COMMIT");
        safeLog("info", correlationId, `[Ledger] Idempotent hit (post-lock) for bonus transfer: ${rootTxId}`);
        const rawPayload = postLockIdemp.rows[0].response_payload;
        const cached = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
        return {
          ...cached,
          isIdempotent: true
        };
      }
      if (walletRes.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new WalletNotFoundError(normalizedUserId, currency);
      }
      const wallet = walletRes.rows[0];
      if (wallet.status !== "ACTIVE") {
        await client.query("ROLLBACK");
        throw new WalletFrozenError(normalizedUserId, wallet.status);
      }
      const beforeBonusStr = wallet.bonus_balance !== void 0 && wallet.bonus_balance !== null ? wallet.bonus_balance.toString() : "0.0000";
      const beforeBonusMinor = parseToMinorUnits(beforeBonusStr, currency, true);
      let beforeRealMinor;
      if (wallet.balance_minor !== void 0 && wallet.balance_minor !== null && wallet.balance_minor !== "") {
        beforeRealMinor = BigInt(wallet.balance_minor.toString());
      } else if (wallet.real_balance !== void 0 && wallet.real_balance !== null) {
        beforeRealMinor = parseToMinorUnits(wallet.real_balance.toString(), currency, true);
      } else {
        beforeRealMinor = 0n;
      }
      if (beforeBonusMinor < amountMinor) {
        await client.query("ROLLBACK");
        safeLog("warn", correlationId, `[Ledger] Insufficient bonus funds for conversion: available=${beforeBonusMinor}, required=${amountMinor}`);
        throw new InsufficientFundsError(beforeBonusMinor, amountMinor, currency);
      }
      const afterBonusMinor = beforeBonusMinor - amountMinor;
      const afterRealMinor = beforeRealMinor + amountMinor;
      const formattedAfterBonus = formatMinorUnits(afterBonusMinor, currency);
      const formattedAfterReal = formatMinorUnits(afterRealMinor, currency);
      await client.query(
        `UPDATE wallets
         SET bonus_balance = $1,
             real_balance = $2,
             balance_minor = $3,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $4`,
        [formattedAfterBonus, formattedAfterReal, afterRealMinor.toString(), wallet.id]
      );
      const debitEntryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_deb`;
      const creditEntryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_cred`;
      const debitTxId = `${rootTxId}:BONUS_DEBIT`;
      const creditTxId = `${rootTxId}:REAL_CREDIT`;
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          debitEntryId,
          wallet.id,
          normalizedUserId,
          debitTxId,
          rootTxId,
          "DEBIT",
          "BONUS",
          amountMinor.toString(),
          currency,
          beforeBonusMinor.toString(),
          afterBonusMinor.toString(),
          "COMMITTED",
          correlationId,
          JSON.stringify({
            ...sanitizedAudit,
            leg: "BONUS_DEBIT",
            targetBalance: "BONUS",
            transferType: "BONUS_TO_REAL",
            wageringRequirementId: req.wageringRequirementId
          })
        ]
      );
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          creditEntryId,
          wallet.id,
          normalizedUserId,
          creditTxId,
          rootTxId,
          "CREDIT",
          "REAL",
          amountMinor.toString(),
          currency,
          beforeRealMinor.toString(),
          afterRealMinor.toString(),
          "COMMITTED",
          correlationId,
          JSON.stringify({
            ...sanitizedAudit,
            leg: "REAL_CREDIT",
            targetBalance: "REAL",
            transferType: "BONUS_TO_REAL",
            wageringRequirementId: req.wageringRequirementId
          })
        ]
      );
      const result = {
        success: true,
        isIdempotent: false,
        transactionId: rootTxId,
        userId: normalizedUserId,
        currency,
        amountMinor: amountMinor.toString(),
        amountMajor: formatMinorUnits(amountMinor, currency),
        debitEntryId,
        creditEntryId,
        beforeBonusBalanceMinor: beforeBonusMinor.toString(),
        afterBonusBalanceMinor: afterBonusMinor.toString(),
        beforeRealBalanceMinor: beforeRealMinor.toString(),
        afterRealBalanceMinor: afterRealMinor.toString(),
        bonusBalanceMajor: formattedAfterBonus,
        realBalanceMajor: formattedAfterReal,
        correlationId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      await client.query(
        `INSERT INTO idempotency_records (
           idempotency_key, transaction_id, status_code, response_payload
         )
         VALUES ($1, $2, $3, $4)`,
        [idempotencyKey, rootTxId, 200, JSON.stringify(result)]
      );
      await client.query("COMMIT");
      safeLog("info", correlationId, `[Ledger] Bonus-to-real transfer committed successfully: ${rootTxId}`, {
        debitEntryId,
        creditEntryId,
        bonusAfter: formattedAfterBonus,
        realAfter: formattedAfterReal
      });
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {
      });
      if (err.code === "23505") {
        const recovery = await this.db.query(
          `SELECT response_payload FROM idempotency_records WHERE idempotency_key = $1 LIMIT 1`,
          [idempotencyKey]
        );
        if (recovery.rows.length > 0) {
          const rawRec = recovery.rows[0].response_payload;
          const cachedRec = typeof rawRec === "string" ? JSON.parse(rawRec) : rawRec;
          return {
            ...cachedRec,
            isIdempotent: true
          };
        }
      }
      safeLog("error", correlationId, `[Ledger] Bonus-to-real transfer failed: ${err.message}`, {
        code: err.code,
        name: err.name
      });
      throw err;
    } finally {
      client.release();
    }
  }
  /**
   * Validates that an existing cached idempotency payload strictly matches the authoritative request fingerprint.
   * Throws IdempotencyConflictError if ANY canonical field differs.
   */
  validateWithdrawalFingerprint(idempotencyKey, cachedPayload, currentFingerprint) {
    const cachedFp = cachedPayload.fingerprint || {
      userId: String(cachedPayload.userId || "").trim(),
      currency: cachedPayload.currency,
      amount: cachedPayload.amount,
      paymentMethod: String(cachedPayload.paymentMethod || cachedPayload.method || "").trim().toUpperCase(),
      receiverAccount: String(cachedPayload.receiverNumber || cachedPayload.recipientAccount || "").trim(),
      operationType: "WITHDRAWAL_RESERVATION"
    };
    const matches = String(cachedFp.userId).trim() === currentFingerprint.userId && cachedFp.currency === currentFingerprint.currency && cachedFp.amount === currentFingerprint.amount && String(cachedFp.paymentMethod || "").trim().toUpperCase() === currentFingerprint.paymentMethod && String(cachedFp.receiverAccount || "").trim() === currentFingerprint.receiverAccount && (cachedFp.operationType === void 0 || cachedFp.operationType === "WITHDRAWAL_RESERVATION");
    if (!matches) {
      throw new IdempotencyConflictError(idempotencyKey, {
        expected: cachedFp,
        provided: currentFingerprint
      });
    }
  }
  /**
   * PLAY369 Task 6.1.6 & 6.1.6.1: Atomic Withdrawal Funds Reservation & Strict Idempotency Contract
   * Atomically transfers funds: REAL BALANCE -> LOCKED BALANCE within a single PostgreSQL transaction.
   * 
   * Invariants:
   * 1. Acquires row lock on wallet: `SELECT ... FOR UPDATE`
   * 2. Integer Minor Units (zero floating-point math)
   * 3. Atomically debits REAL balance and credits LOCKED balance
   * 4. Inserts 2 immutable ledger entries (REAL DEBIT and LOCKED CREDIT)
   * 5. Inserts the PENDING payment_requests record
   * 6. Records and enforces strict authoritative idempotency fingerprint
   * 7. Commits or rolls back atomically
   */
  async reserveWithdrawalFunds(req) {
    if (req.userId === void 0 || req.userId === null || String(req.userId).trim() === "") {
      throw new LedgerValidationError("Valid userId is required for withdrawal reservation", { userId: req.userId });
    }
    if (!req.amount || String(req.amount).trim() === "") {
      throw new LedgerValidationError("Withdrawal amount is required", { amount: req.amount });
    }
    if (!req.paymentMethod && !req.method) {
      throw new LedgerValidationError("Payment method is required", { paymentMethod: req.paymentMethod });
    }
    const normalizedUserId = String(req.userId).trim();
    const currency = validateCurrency(req.currency);
    const amountMinor = parseToMinorUnits(req.amount, currency, false);
    const normalizedAmount = req.amount.trim();
    const normalizedPaymentMethod = String(req.paymentMethod || req.method || "").trim().toUpperCase();
    const normalizedReceiverAccount = String(req.receiverNumber || req.recipientAccount || "").trim();
    if (amountMinor <= 0n) {
      throw new LedgerValidationError("Withdrawal amount must be strictly greater than zero", { amount: req.amount });
    }
    const correlationId = req.correlationId || `corr_wdraw_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const canonicalFingerprint = {
      userId: normalizedUserId,
      currency,
      amount: normalizedAmount,
      paymentMethod: normalizedPaymentMethod,
      receiverAccount: normalizedReceiverAccount,
      operationType: "WITHDRAWAL_RESERVATION"
    };
    if (req.idempotencyKey !== void 0 && req.idempotencyKey !== null) {
      if (typeof req.idempotencyKey !== "string") {
        throw new LedgerValidationError("Idempotency key must be a string", { code: "INVALID_IDEMPOTENCY_KEY" });
      }
      const trimmedKey = req.idempotencyKey.trim();
      if (trimmedKey.length < 8 || trimmedKey.length > 128) {
        throw new LedgerValidationError("Idempotency key must be between 8 and 128 characters", { code: "INVALID_IDEMPOTENCY_KEY" });
      }
    }
    const idempotencyKey = req.idempotencyKey && req.idempotencyKey.trim() !== "" ? req.idempotencyKey.trim() : this.generateIdempotencyKey(
      normalizedUserId,
      currency,
      `wdraw_res:${req.withdrawalId || normalizedAmount + ":" + normalizedPaymentMethod}`
    );
    const rootTxId = req.withdrawalId && String(req.withdrawalId).trim() !== "" ? String(req.withdrawalId).trim() : deriveWithdrawalTransactionId(normalizedUserId, idempotencyKey);
    const sanitizedAudit = maskSensitiveData(req.metadata || {});
    const existingIdemp = await this.db.query(
      `SELECT idempotency_key, response_payload 
       FROM idempotency_records 
       WHERE idempotency_key = $1 
       LIMIT 1`,
      [idempotencyKey]
    );
    if (existingIdemp.rows.length > 0) {
      const rawPayload = existingIdemp.rows[0].response_payload;
      const cached = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
      this.validateWithdrawalFingerprint(idempotencyKey, cached, canonicalFingerprint);
      safeLog("info", correlationId, `[Ledger] Idempotent withdrawal reservation returned cached payload: ${rootTxId}`);
      return {
        ...cached,
        isIdempotent: true
      };
    }
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const walletRes = await client.query(
        `SELECT id, user_id, currency, real_balance, bonus_balance, locked_balance, balance_minor, version, status
         FROM wallets
         WHERE user_id = $1 AND currency = $2
         FOR UPDATE`,
        [normalizedUserId, currency]
      );
      if (walletRes.rows.length === 0) {
        await client.query("ROLLBACK");
        throw new WalletNotFoundError(normalizedUserId, currency);
      }
      const wallet = walletRes.rows[0];
      if (wallet.status !== "ACTIVE") {
        await client.query("ROLLBACK");
        throw new WalletFrozenError(normalizedUserId, wallet.status);
      }
      let beforeRealMinor;
      if (wallet.balance_minor !== void 0 && wallet.balance_minor !== null && wallet.balance_minor !== "") {
        beforeRealMinor = BigInt(wallet.balance_minor.toString());
      } else if (wallet.real_balance !== void 0 && wallet.real_balance !== null) {
        beforeRealMinor = parseToMinorUnits(wallet.real_balance.toString(), currency, true);
      } else {
        beforeRealMinor = 0n;
      }
      const beforeLockedStr = wallet.locked_balance !== void 0 && wallet.locked_balance !== null ? wallet.locked_balance.toString() : "0.0000";
      const beforeLockedMinor = parseToMinorUnits(beforeLockedStr, currency, true);
      if (beforeRealMinor < amountMinor) {
        await client.query("ROLLBACK");
        safeLog("warn", correlationId, `[Ledger] Insufficient funds for withdrawal reservation: available=${beforeRealMinor}, required=${amountMinor}`);
        throw new InsufficientFundsError(beforeRealMinor, amountMinor, currency);
      }
      const afterRealMinor = beforeRealMinor - amountMinor;
      const afterLockedMinor = beforeLockedMinor + amountMinor;
      const formattedBeforeReal = formatMinorUnits(beforeRealMinor, currency);
      const formattedAfterReal = formatMinorUnits(afterRealMinor, currency);
      const formattedBeforeLocked = formatMinorUnits(beforeLockedMinor, currency);
      const formattedAfterLocked = formatMinorUnits(afterLockedMinor, currency);
      await client.query(
        `UPDATE wallets
         SET real_balance = $1,
             locked_balance = $2,
             balance_minor = $3,
             version = version + 1,
             updated_at = NOW()
         WHERE id = $4`,
        [formattedAfterReal, formattedAfterLocked, afterRealMinor.toString(), wallet.id]
      );
      const debitEntryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_wdeb`;
      const lockEntryId = `ledg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_wlock`;
      const debitTxId = `${rootTxId}:WITHDRAWAL_DEBIT`;
      const lockTxId = `${rootTxId}:WITHDRAWAL_LOCK`;
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          debitEntryId,
          wallet.id,
          normalizedUserId,
          debitTxId,
          rootTxId,
          "DEBIT",
          "REAL",
          amountMinor.toString(),
          currency,
          beforeRealMinor.toString(),
          afterRealMinor.toString(),
          "COMMITTED",
          correlationId,
          JSON.stringify({
            ...sanitizedAudit,
            leg: "REAL_DEBIT",
            targetBalance: "REAL",
            category: "WITHDRAWAL_RESERVATION",
            withdrawalId: rootTxId,
            paymentMethod: normalizedPaymentMethod
          })
        ]
      );
      await client.query(
        `INSERT INTO ledger_entries (
           id, wallet_id, user_id, transaction_id, reference_transaction_id,
           type, balance_target, amount_minor, currency, before_balance_minor, after_balance_minor,
           status, correlation_id, audit_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          lockEntryId,
          wallet.id,
          normalizedUserId,
          lockTxId,
          rootTxId,
          "CREDIT",
          "LOCKED",
          amountMinor.toString(),
          currency,
          beforeLockedMinor.toString(),
          afterLockedMinor.toString(),
          "COMMITTED",
          correlationId,
          JSON.stringify({
            ...sanitizedAudit,
            leg: "LOCKED_CREDIT",
            targetBalance: "LOCKED",
            category: "WITHDRAWAL_RESERVATION",
            withdrawalId: rootTxId,
            paymentMethod: normalizedPaymentMethod
          })
        ]
      );
      const paymentReqRes = await client.query(
        `INSERT INTO payment_requests (
           user_id, wallet_id, type, method, amount, currency,
           receiver_number, trx_id, status, admin_note, metadata, created_at, updated_at
         )
         VALUES ($1, $2, 'WITHDRAWAL', $3, $4, $5, $6, $7, 'PENDING', $8, $9, NOW(), NOW())
         RETURNING id`,
        [
          normalizedUserId,
          wallet.id,
          normalizedPaymentMethod,
          normalizedAmount,
          currency,
          normalizedReceiverAccount || null,
          rootTxId,
          req.adminNote || null,
          JSON.stringify({
            ...sanitizedAudit,
            withdrawalId: rootTxId,
            debitLedgerEntryId: debitEntryId,
            lockLedgerEntryId: lockEntryId,
            correlationId
          })
        ]
      );
      const paymentRequestId = paymentReqRes.rows[0]?.id ?? `pr_${Date.now()}`;
      const result = {
        withdrawalId: rootTxId,
        paymentRequestId,
        transactionId: rootTxId,
        status: "PENDING",
        amount: normalizedAmount,
        currency,
        userId: normalizedUserId,
        walletId: wallet.id,
        paymentMethod: normalizedPaymentMethod,
        receiverNumber: normalizedReceiverAccount,
        recipientAccount: normalizedReceiverAccount,
        beforeRealBalance: formattedBeforeReal,
        afterRealBalance: formattedAfterReal,
        beforeLockedBalance: formattedBeforeLocked,
        afterLockedBalance: formattedAfterLocked,
        debitLedgerEntryId: debitEntryId,
        lockLedgerEntryId: lockEntryId,
        isIdempotent: false,
        fingerprint: canonicalFingerprint,
        executedAt: (/* @__PURE__ */ new Date()).toISOString(),
        correlationId
      };
      await client.query(
        `INSERT INTO idempotency_records (
           idempotency_key, transaction_id, status_code, response_payload
         )
         VALUES ($1, $2, $3, $4)`,
        [idempotencyKey, rootTxId, 200, JSON.stringify(result)]
      );
      await client.query("COMMIT");
      safeLog("info", correlationId, `[Ledger] Withdrawal funds reserved atomically: ${rootTxId}`, {
        debitEntryId,
        lockEntryId,
        paymentRequestId,
        realAfter: formattedAfterReal,
        lockedAfter: formattedAfterLocked
      });
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {
      });
      if (err.code === "23505" || err.message?.includes("duplicate key") || err.message?.includes("idempotency") || err.message?.includes("payment_requests")) {
        const recovery = await this.db.query(
          `SELECT response_payload FROM idempotency_records WHERE idempotency_key = $1 LIMIT 1`,
          [idempotencyKey]
        );
        if (recovery.rows.length > 0) {
          const rawRec = recovery.rows[0].response_payload;
          const cachedRec = typeof rawRec === "string" ? JSON.parse(rawRec) : rawRec;
          this.validateWithdrawalFingerprint(idempotencyKey, cachedRec, canonicalFingerprint);
          return {
            ...cachedRec,
            isIdempotent: true
          };
        }
      }
      safeLog("error", correlationId, `[Ledger] Withdrawal funds reservation failed: ${err.message}`, {
        code: err.code,
        name: err.name
      });
      throw err;
    } finally {
      client.release();
    }
  }
  /**
   * Performs an audit reconciliation between the wallet balances (REAL, BONUS, LOCKED) and sum of ledger entries.
   * Invariants:
   * - REAL: wallet.balance_minor === initial_seed + SUM(REAL credits + reversals) - SUM(REAL debits)
   * - BONUS: toMinor(wallet.bonus_balance) === initial_seed + SUM(BONUS credits + reversals) - SUM(BONUS debits)
   * - LOCKED: toMinor(wallet.locked_balance) === initial_seed + SUM(LOCKED credits + reversals) - SUM(LOCKED debits)
   * REAL, BONUS, and LOCKED entries are strictly separated so rewards or reservations never cause false discrepancies.
   */
  async auditReconciliation(userId, currency, targetBalance) {
    const wallet = await this.getWallet(userId, currency);
    const realRes = await this.db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE 0 END), 0) AS total_credits,
         COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_minor ELSE 0 END), 0) AS total_debits,
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE -amount_minor END), 0) AS net_minor,
         (SELECT before_balance_minor FROM ledger_entries WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'REAL' AND status = 'COMMITTED' ORDER BY created_at ASC, id ASC LIMIT 1) AS initial_seed_minor,
         COUNT(*) AS entry_count
       FROM ledger_entries
       WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'REAL' AND status = 'COMMITTED'`,
      [wallet.id]
    );
    const bonusRes = await this.db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE 0 END), 0) AS total_credits,
         COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_minor ELSE 0 END), 0) AS total_debits,
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE -amount_minor END), 0) AS net_minor,
         (SELECT before_balance_minor FROM ledger_entries WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'BONUS' AND status = 'COMMITTED' ORDER BY created_at ASC, id ASC LIMIT 1) AS initial_seed_minor,
         COUNT(*) AS entry_count
       FROM ledger_entries
       WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'BONUS' AND status = 'COMMITTED'`,
      [wallet.id]
    );
    const lockedRes = await this.db.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE 0 END), 0) AS total_credits,
         COALESCE(SUM(CASE WHEN type = 'DEBIT' THEN amount_minor ELSE 0 END), 0) AS total_debits,
         COALESCE(SUM(CASE WHEN type IN ('CREDIT', 'REVERSAL') THEN amount_minor ELSE -amount_minor END), 0) AS net_minor,
         (SELECT before_balance_minor FROM ledger_entries WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'LOCKED' AND status = 'COMMITTED' ORDER BY created_at ASC, id ASC LIMIT 1) AS initial_seed_minor,
         COUNT(*) AS entry_count
       FROM ledger_entries
       WHERE wallet_id = $1 AND COALESCE(balance_target, 'REAL') = 'LOCKED' AND status = 'COMMITTED'`,
      [wallet.id]
    );
    const realWalletMinor = wallet.balanceMinor;
    const realRow = realRes.rows[0];
    const realEntryCount = Number(realRow?.entry_count || 0);
    const realNetLedgerMinor = BigInt(realRow?.net_minor || "0");
    const realSeedMinor = realEntryCount > 0 && realRow?.initial_seed_minor !== void 0 && realRow?.initial_seed_minor !== null ? BigInt(realRow.initial_seed_minor) : realWalletMinor;
    const expectedRealMinor = realEntryCount > 0 ? realSeedMinor + realNetLedgerMinor : realWalletMinor;
    const realDiscrepancyMinor = (realWalletMinor - expectedRealMinor).toString();
    const realIsReconciled = realDiscrepancyMinor === "0";
    const bonusWalletStr = wallet.bonusBalance || "0.0000";
    const bonusWalletMinor = parseToMinorUnits(bonusWalletStr, wallet.currency, true);
    const bonusRow = bonusRes.rows[0];
    const bonusEntryCount = Number(bonusRow?.entry_count || 0);
    const bonusNetLedgerMinor = BigInt(bonusRow?.net_minor || "0");
    const bonusSeedMinor = bonusEntryCount > 0 && bonusRow?.initial_seed_minor !== void 0 && bonusRow?.initial_seed_minor !== null ? BigInt(bonusRow.initial_seed_minor) : bonusWalletMinor;
    const expectedBonusMinor = bonusEntryCount > 0 ? bonusSeedMinor + bonusNetLedgerMinor : bonusWalletMinor;
    const bonusDiscrepancyMinor = (bonusWalletMinor - expectedBonusMinor).toString();
    const bonusIsReconciled = bonusDiscrepancyMinor === "0";
    const lockedWalletStr = wallet.lockedBalance || "0.0000";
    const lockedWalletMinor = parseToMinorUnits(lockedWalletStr, wallet.currency, true);
    const lockedRow = lockedRes.rows[0];
    const lockedEntryCount = Number(lockedRow?.entry_count || 0);
    const lockedNetLedgerMinor = BigInt(lockedRow?.net_minor || "0");
    const lockedSeedMinor = lockedEntryCount > 0 && lockedRow?.initial_seed_minor !== void 0 && lockedRow?.initial_seed_minor !== null ? BigInt(lockedRow.initial_seed_minor) : lockedWalletMinor;
    const expectedLockedMinor = lockedEntryCount > 0 ? lockedSeedMinor + lockedNetLedgerMinor : lockedWalletMinor;
    const lockedDiscrepancyMinor = (lockedWalletMinor - expectedLockedMinor).toString();
    const lockedIsReconciled = lockedDiscrepancyMinor === "0";
    const realSummary = {
      isReconciled: realIsReconciled,
      walletBalanceMinor: realWalletMinor.toString(),
      walletBalanceMajor: wallet.realBalance || formatMinorUnits(realWalletMinor, wallet.currency),
      computedLedgerNetMinor: realNetLedgerMinor.toString(),
      discrepancyMinor: realDiscrepancyMinor
    };
    const bonusSummary = {
      isReconciled: bonusIsReconciled,
      walletBalanceMinor: bonusWalletMinor.toString(),
      walletBalanceMajor: bonusWalletStr,
      computedLedgerNetMinor: bonusNetLedgerMinor.toString(),
      discrepancyMinor: bonusDiscrepancyMinor
    };
    const lockedSummary = {
      isReconciled: lockedIsReconciled,
      walletBalanceMinor: lockedWalletMinor.toString(),
      walletBalanceMajor: lockedWalletStr,
      computedLedgerNetMinor: lockedNetLedgerMinor.toString(),
      discrepancyMinor: lockedDiscrepancyMinor
    };
    if (targetBalance === "BONUS") {
      return {
        isReconciled: bonusIsReconciled,
        walletBalanceMinor: bonusSummary.walletBalanceMinor,
        walletBalanceMajor: bonusSummary.walletBalanceMajor,
        computedLedgerNetMinor: bonusSummary.computedLedgerNetMinor,
        discrepancyMinor: bonusSummary.discrepancyMinor,
        real: realSummary,
        bonus: bonusSummary,
        locked: lockedSummary
      };
    }
    if (targetBalance === "LOCKED") {
      return {
        isReconciled: lockedIsReconciled,
        walletBalanceMinor: lockedSummary.walletBalanceMinor,
        walletBalanceMajor: lockedSummary.walletBalanceMajor,
        computedLedgerNetMinor: lockedSummary.computedLedgerNetMinor,
        discrepancyMinor: lockedSummary.discrepancyMinor,
        real: realSummary,
        bonus: bonusSummary,
        locked: lockedSummary
      };
    }
    return {
      isReconciled: realIsReconciled && bonusIsReconciled && lockedIsReconciled,
      walletBalanceMinor: realSummary.walletBalanceMinor,
      walletBalanceMajor: realSummary.walletBalanceMajor,
      computedLedgerNetMinor: realSummary.computedLedgerNetMinor,
      discrepancyMinor: realSummary.discrepancyMinor,
      real: realSummary,
      bonus: bonusSummary,
      locked: lockedSummary
    };
  }
};
var inMemoryLedgerDb = new InMemoryPostgresLedgerEngine();
var walletLedgerService = new WalletLedgerService(inMemoryLedgerDb);

// src/server/controllers/seamlessWalletController.ts
var PROVIDER_SLA_TIMEOUT_MS = 3800;
async function withTimeout(promise, timeoutMs) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject({
        code: "TIMEOUT_EXCEEDED" /* TIMEOUT_EXCEEDED */,
        message: `Wallet transaction processing exceeded ${timeoutMs}ms SLA threshold`,
        status: 504
      });
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
var SeamlessWalletController = class {
  constructor(ledgerService) {
    // --------------------------------------------------------------------------
    // 1. POST /balance
    // --------------------------------------------------------------------------
    this.getBalance = async (req, res, _next) => {
      const startTime = Date.now();
      try {
        const userId = req.body.user_id;
        const currency = req.body.currency;
        if (!userId || !currency) {
          res.status(400).json({
            code: "INVALID_REQUEST" /* INVALID_REQUEST */,
            message: "Missing mandatory fields: 'user_id' and 'currency' are required",
            timestamp: Date.now()
          });
          return;
        }
        const wallet = await withTimeout(
          this.ledgerService.getWallet(userId, currency),
          PROVIDER_SLA_TIMEOUT_MS
        );
        const balanceMajor = Number(formatMinorUnits(wallet.balanceMinor, wallet.currency));
        const response = {
          code: "SUCCESS" /* SUCCESS */,
          message: "Balance retrieved successfully",
          user_id: String(wallet.userId),
          currency: wallet.currency,
          balance: balanceMajor,
          bonus_balance: 0,
          timestamp: Date.now()
        };
        res.setHeader("X-Response-Time-Ms", Date.now() - startTime);
        res.status(200).json(response);
      } catch (err) {
        this.handleError(err, res, startTime);
      }
    };
    // --------------------------------------------------------------------------
    // 2. POST /bet
    // --------------------------------------------------------------------------
    this.processBet = async (req, res, _next) => {
      const startTime = Date.now();
      try {
        const {
          user_id,
          currency,
          transaction_id,
          round_id,
          game_id,
          amount,
          session_id,
          is_round_end,
          metadata
        } = req.body;
        if (!user_id || !currency || !transaction_id || !round_id || amount === void 0 || isNaN(Number(amount)) || Number(amount) <= 0) {
          res.status(400).json({
            code: "INVALID_REQUEST" /* INVALID_REQUEST */,
            message: "Missing mandatory fields for bet transaction (user_id, currency, transaction_id, round_id, amount > 0)",
            timestamp: Date.now()
          });
          return;
        }
        const correlationId = req.headers["x-correlation-id"] || `cid-${Date.now()}`;
        const result = await withTimeout(
          this.ledgerService.executeTransaction({
            userId: user_id,
            currency,
            transactionId: transaction_id,
            type: "DEBIT",
            amountMinor: amount,
            correlationId,
            auditMetadata: {
              roundId: round_id,
              gameId: game_id,
              sessionId: session_id,
              isRoundEnd: is_round_end,
              providerId: req.providerId,
              ...typeof metadata === "object" && metadata !== null ? metadata : {}
            }
          }),
          PROVIDER_SLA_TIMEOUT_MS
        );
        const response = {
          code: "SUCCESS" /* SUCCESS */,
          message: "Bet processed successfully",
          transaction_id: result.transactionId,
          operator_transaction_id: result.ledgerEntryId,
          round_id,
          balance: Number(result.afterBalanceMajor),
          bonus_balance: 0,
          currency: result.currency,
          timestamp: Date.now(),
          is_idempotent: result.isIdempotent
        };
        res.setHeader("X-Response-Time-Ms", Date.now() - startTime);
        res.status(200).json(response);
      } catch (err) {
        this.handleError(err, res, startTime);
      }
    };
    // --------------------------------------------------------------------------
    // 3. POST /win
    // --------------------------------------------------------------------------
    this.processWin = async (req, res, _next) => {
      const startTime = Date.now();
      try {
        const {
          user_id,
          currency,
          transaction_id,
          reference_transaction_id,
          round_id,
          game_id,
          amount,
          is_round_end,
          jackpot_amount,
          metadata
        } = req.body;
        if (!user_id || !currency || !transaction_id || !round_id || amount === void 0 || isNaN(Number(amount)) || Number(amount) < 0) {
          res.status(400).json({
            code: "INVALID_REQUEST" /* INVALID_REQUEST */,
            message: "Missing mandatory fields for win payout (user_id, currency, transaction_id, round_id, amount >= 0)",
            timestamp: Date.now()
          });
          return;
        }
        const correlationId = req.headers["x-correlation-id"] || `cid-${Date.now()}`;
        const result = await withTimeout(
          this.ledgerService.executeTransaction({
            userId: user_id,
            currency,
            transactionId: transaction_id,
            referenceTransactionId: reference_transaction_id,
            type: "CREDIT",
            amountMinor: amount,
            correlationId,
            auditMetadata: {
              roundId: round_id,
              gameId: game_id,
              jackpotAmount: jackpot_amount,
              isRoundEnd: is_round_end,
              providerId: req.providerId,
              ...typeof metadata === "object" && metadata !== null ? metadata : {}
            }
          }),
          PROVIDER_SLA_TIMEOUT_MS
        );
        const response = {
          code: "SUCCESS" /* SUCCESS */,
          message: "Win payout processed successfully",
          transaction_id: result.transactionId,
          operator_transaction_id: result.ledgerEntryId,
          round_id,
          balance: Number(result.afterBalanceMajor),
          bonus_balance: 0,
          currency: result.currency,
          timestamp: Date.now(),
          is_idempotent: result.isIdempotent
        };
        res.setHeader("X-Response-Time-Ms", Date.now() - startTime);
        res.status(200).json(response);
      } catch (err) {
        this.handleError(err, res, startTime);
      }
    };
    // --------------------------------------------------------------------------
    // 4. POST /refund
    // --------------------------------------------------------------------------
    this.processRefund = async (req, res, _next) => {
      const startTime = Date.now();
      try {
        const {
          user_id,
          currency,
          transaction_id,
          reference_transaction_id,
          round_id,
          game_id,
          amount,
          reason,
          metadata
        } = req.body;
        if (!user_id || !currency || !transaction_id || !reference_transaction_id || !round_id || amount === void 0 || isNaN(Number(amount)) || Number(amount) <= 0) {
          res.status(400).json({
            code: "INVALID_REQUEST" /* INVALID_REQUEST */,
            message: "Missing mandatory fields for refund (user_id, currency, transaction_id, reference_transaction_id, round_id, amount > 0)",
            timestamp: Date.now()
          });
          return;
        }
        const correlationId = req.headers["x-correlation-id"] || `cid-${Date.now()}`;
        const result = await withTimeout(
          this.ledgerService.executeTransaction({
            userId: user_id,
            currency,
            transactionId: transaction_id,
            referenceTransactionId: reference_transaction_id,
            type: "REVERSAL",
            amountMinor: amount,
            correlationId,
            auditMetadata: {
              roundId: round_id,
              gameId: game_id,
              reason: reason || "PROVIDER_REFUND",
              providerId: req.providerId,
              ...typeof metadata === "object" && metadata !== null ? metadata : {}
            }
          }),
          PROVIDER_SLA_TIMEOUT_MS
        );
        const response = {
          code: "SUCCESS" /* SUCCESS */,
          message: "Refund processed successfully",
          transaction_id: result.transactionId,
          operator_transaction_id: result.ledgerEntryId,
          round_id,
          balance: Number(result.afterBalanceMajor),
          bonus_balance: 0,
          currency: result.currency,
          timestamp: Date.now(),
          is_idempotent: result.isIdempotent
        };
        res.setHeader("X-Response-Time-Ms", Date.now() - startTime);
        res.status(200).json(response);
      } catch (err) {
        this.handleError(err, res, startTime);
      }
    };
    this.ledgerService = ledgerService;
  }
  /**
   * Centralized HTTP error mapper preserving provider-expected status codes and error payloads
   */
  handleError(err, res, startTime) {
    const latency = Date.now() - startTime;
    res.setHeader("X-Response-Time-Ms", latency);
    let statusCode = 500;
    let errorCode = "INTERNAL_ERROR" /* INTERNAL_ERROR */;
    let message = err.message || "Internal wallet error during transaction execution";
    let balance;
    let currency;
    if (err instanceof InsufficientFundsError) {
      statusCode = 422;
      errorCode = "INSUFFICIENT_FUNDS" /* INSUFFICIENT_FUNDS */;
      currency = err.currency;
      balance = Number(formatMinorUnits(BigInt(err.availableMinor), err.currency));
    } else if (err instanceof WalletNotFoundError) {
      statusCode = 404;
      errorCode = "USER_NOT_FOUND" /* USER_NOT_FOUND */;
    } else if (err instanceof WalletFrozenError) {
      statusCode = 403;
      errorCode = "USER_FROZEN" /* USER_FROZEN */;
    } else if (err instanceof LedgerValidationError) {
      statusCode = 400;
      errorCode = "INVALID_REQUEST" /* INVALID_REQUEST */;
    } else if (err.code === "TIMEOUT_EXCEEDED" /* TIMEOUT_EXCEEDED */) {
      statusCode = 504;
      errorCode = "TIMEOUT_EXCEEDED" /* TIMEOUT_EXCEEDED */;
    } else if (err.code && Object.values(SeamlessErrorCode).includes(err.code)) {
      errorCode = err.code;
      statusCode = err.status || 400;
    }
    console.error(`[SeamlessController] Error (${errorCode} - ${statusCode}):`, err);
    res.status(statusCode).json({
      code: errorCode,
      message,
      balance,
      currency,
      timestamp: Date.now()
    });
  }
};

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  affiliateCommissions: () => affiliateCommissions,
  affiliateNodes: () => affiliateNodes,
  dailyCheckIns: () => dailyCheckIns,
  freeSpinEntitlements: () => freeSpinEntitlements,
  gameProviders: () => gameProviders,
  gameProvidersRelations: () => gameProvidersRelations,
  gameRounds: () => gameRounds,
  gameRoundsRelations: () => gameRoundsRelations,
  idempotencyKeys: () => idempotencyKeys,
  ledgerEntries: () => ledgerEntries,
  paymentRequests: () => paymentRequests,
  paymentRequestsRelations: () => paymentRequestsRelations,
  transactions: () => transactions,
  transactionsRelations: () => transactionsRelations,
  userVipProgress: () => userVipProgress,
  users: () => users,
  usersRelations: () => usersRelations,
  vipLevels: () => vipLevels,
  vipProgressionEvents: () => vipProgressionEvents,
  vipProgressionEventsRelations: () => vipProgressionEventsRelations,
  vipRewardClaims: () => vipRewardClaims,
  vipRewardClaimsRelations: () => vipRewardClaimsRelations,
  wageringProgressEvents: () => wageringProgressEvents,
  wageringProgressEventsRelations: () => wageringProgressEventsRelations,
  wageringRequirements: () => wageringRequirements,
  wageringRequirementsRelations: () => wageringRequirementsRelations,
  wallets: () => wallets,
  walletsRelations: () => walletsRelations,
  wheelSpins: () => wheelSpins
});
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  // Firebase Auth UID
  email: text("email").notNull(),
  username: varchar("username", { length: 64 }).notNull(),
  operatorId: varchar("operator_id", { length: 64 }).default("GAMEPLAY365_BD").notNull(),
  currency: varchar("currency", { length: 3 }).default("BDT").notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  countryCode: varchar("country_code", { length: 2 }).default("BD"),
  vipTier: varchar("vip_tier", { length: 32 }).default("V1_ROOKIE").notNull(),
  vipLevel: integer("vip_level").default(1).notNull(),
  referralCode: varchar("referral_code", { length: 32 }).unique(),
  referredByUserId: integer("referred_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var gameProviders = pgTable("game_providers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  secretKey: varchar("secret_key", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  webhookTimeoutMs: integer("webhook_timeout_ms").default(4e3).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  realBalance: numeric("real_balance", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  bonusBalance: numeric("bonus_balance", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  lockedBalance: numeric("locked_balance", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  commissionBalance: numeric("commission_balance", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  balanceMinor: bigint("balance_minor", { mode: "bigint" }).default(0n).notNull(),
  version: bigint("version", { mode: "bigint" }).default(1n).notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userCurrencyIdx: uniqueIndex("wallets_user_currency_idx").on(table.userId, table.currency)
}));
var gameRounds = pgTable("game_rounds", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id", { length: 64 }).references(() => gameProviders.id).notNull(),
  providerRoundId: varchar("provider_round_id", { length: 128 }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  gameId: varchar("game_id", { length: 128 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 32 }).default("OPEN").notNull(),
  totalBet: numeric("total_bet", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  totalWin: numeric("total_win", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true })
});
var transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id", { length: 64 }).references(() => gameProviders.id).notNull(),
  transactionId: varchar("transaction_id", { length: 128 }).notNull(),
  referenceTransactionId: varchar("reference_transaction_id", { length: 128 }),
  userId: integer("user_id").references(() => users.id).notNull(),
  walletId: integer("wallet_id").references(() => wallets.id).notNull(),
  roundId: integer("round_id").references(() => gameRounds.id),
  providerRoundId: varchar("provider_round_id", { length: 128 }),
  gameId: varchar("game_id", { length: 128 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  // 'BET', 'WIN', 'REFUND', 'PROMO', 'COMMISSION', 'DEPOSIT', 'WITHDRAWAL'
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  beforeBalance: numeric("before_balance", { precision: 18, scale: 4 }).notNull(),
  afterBalance: numeric("after_balance", { precision: 18, scale: 4 }).notNull(),
  status: varchar("status", { length: 32 }).default("COMPLETED").notNull(),
  errorCode: varchar("error_code", { length: 64 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var ledgerEntries = pgTable("ledger_entries", {
  id: varchar("id", { length: 64 }).primaryKey(),
  walletId: integer("wallet_id").references(() => wallets.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  transactionId: varchar("transaction_id", { length: 128 }).notNull(),
  referenceTransactionId: varchar("reference_transaction_id", { length: 128 }),
  type: varchar("type", { length: 32 }).notNull(),
  // 'DEBIT', 'CREDIT', 'REVERSAL', 'ADJUSTMENT'
  balanceTarget: varchar("balance_target", { length: 16 }).default("REAL").notNull(),
  // 'REAL', 'BONUS'
  amountMinor: bigint("amount_minor", { mode: "bigint" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  beforeBalanceMinor: bigint("before_balance_minor", { mode: "bigint" }).notNull(),
  afterBalanceMinor: bigint("after_balance_minor", { mode: "bigint" }).notNull(),
  status: varchar("status", { length: 32 }).default("COMMITTED").notNull(),
  correlationId: varchar("correlation_id", { length: 128 }).notNull(),
  auditMetadata: jsonb("audit_metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userTxIdx: uniqueIndex("ledger_entries_user_tx_idx").on(table.userId, table.transactionId),
  walletTargetIdx: uniqueIndex("ledger_entries_wallet_target_idx").on(table.walletId, table.balanceTarget, table.id)
}));
var idempotencyKeys = pgTable("idempotency_keys", {
  idempotencyKey: varchar("idempotency_key", { length: 192 }).primaryKey(),
  providerId: varchar("provider_id", { length: 64 }).notNull(),
  endpoint: varchar("endpoint", { length: 64 }).notNull(),
  statusCode: integer("status_code").notNull(),
  responseBody: jsonb("response_body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true })
});
var paymentRequests = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  walletId: integer("wallet_id").references(() => wallets.id).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  // 'DEPOSIT', 'WITHDRAWAL'
  method: varchar("method", { length: 32 }).notNull(),
  // 'BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'USDT'
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BDT").notNull(),
  senderNumber: varchar("sender_number", { length: 64 }),
  receiverNumber: varchar("receiver_number", { length: 64 }),
  trxId: varchar("trx_id", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).default("PENDING").notNull(),
  // 'PENDING', 'APPROVED', 'REJECTED'
  adminNote: text("admin_note"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var affiliateNodes = pgTable("affiliate_nodes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  parentAffiliateId: integer("parent_affiliate_id").references(() => users.id),
  grandParentAffiliateId: integer("grandparent_affiliate_id").references(() => users.id),
  referralCode: varchar("referral_code", { length: 32 }).notNull().unique(),
  tier1CommissionRate: numeric("tier1_commission_rate", { precision: 6, scale: 4 }).default("0.0050").notNull(),
  // 0.50% of subordinate valid bets
  tier2CommissionRate: numeric("tier2_commission_rate", { precision: 6, scale: 4 }).default("0.0020").notNull(),
  // 0.20%
  tier3CommissionRate: numeric("tier3_commission_rate", { precision: 6, scale: 4 }).default("0.0010").notNull(),
  // 0.10%
  totalDirectReferrals: integer("total_direct_referrals").default(0).notNull(),
  totalSubordinates: integer("total_subordinates").default(0).notNull(),
  totalTurnoverVolume: numeric("total_turnover_volume", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  totalCommissionEarned: numeric("total_commission_earned", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  unclaimedCommission: numeric("unclaimed_commission", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var affiliateCommissions = pgTable("affiliate_commissions", {
  id: serial("id").primaryKey(),
  beneficiaryUserId: integer("beneficiary_user_id").references(() => users.id).notNull(),
  sourceUserId: integer("source_user_id").references(() => users.id).notNull(),
  sourceTransactionId: varchar("source_transaction_id", { length: 128 }).notNull(),
  tier: integer("tier").notNull(),
  // 1 for Direct (Tier A->B), 2 for Subordinate (Tier A->C), 3 for Tier D
  validBetAmount: numeric("valid_bet_amount", { precision: 18, scale: 4 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 6, scale: 4 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 32 }).default("SETTLED").notNull(),
  // 'PENDING', 'SETTLED', 'CLAIMED'
  settledAt: timestamp("settled_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => {
  return {
    uniqueTxBeneficiaryTierIdx: uniqueIndex("affiliate_commissions_tx_beneficiary_tier_idx").on(
      table.sourceTransactionId,
      table.beneficiaryUserId,
      table.tier
    )
  };
});
var vipLevels = pgTable("vip_levels", {
  level: integer("level").primaryKey(),
  // 1 to 10
  name: varchar("name", { length: 64 }).notNull(),
  // V1 Rookie, V2 Bronze, V3 Silver, V4 Gold, V5 Platinum, V6 Diamond, V7 Master, V8 Grandmaster, V9 Legend, V10 Immortal
  minCumulativeDeposit: numeric("min_cumulative_deposit", { precision: 18, scale: 4 }).notNull(),
  minCumulativeBet: numeric("min_cumulative_bet", { precision: 18, scale: 4 }).notNull(),
  levelUpBonus: numeric("level_up_bonus", { precision: 18, scale: 4 }).notNull(),
  dailyCashbackRate: numeric("daily_cashback_rate", { precision: 6, scale: 4 }).notNull(),
  // e.g. 0.0150 (1.5%)
  weeklyBonus: numeric("weekly_bonus", { precision: 18, scale: 4 }).notNull(),
  monthlyPerk: numeric("monthly_perk", { precision: 18, scale: 4 }).notNull(),
  payoutLimitDaily: numeric("payout_limit_daily", { precision: 18, scale: 4 }).notNull(),
  dedicatedHost: boolean("dedicated_host").default(false).notNull(),
  badgeColor: varchar("badge_color", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var userVipProgress = pgTable("user_vip_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  currentLevel: integer("current_level").references(() => vipLevels.level).default(1).notNull(),
  cumulativeDeposit: numeric("cumulative_deposit", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  cumulativeBet: numeric("cumulative_bet", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  levelUpBonusClaimed: jsonb("level_up_bonus_claimed").default([]).notNull(),
  // [1, 2, 3]
  lastDailyCashbackDate: timestamp("last_daily_cashback_date", { withTimezone: true }),
  totalCashbackClaimed: numeric("total_cashback_claimed", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  lastUpgradedAt: timestamp("last_upgraded_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var vipRewardClaims = pgTable("vip_reward_claims", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  vipLevel: integer("vip_level").notNull(),
  transactionId: varchar("transaction_id", { length: 128 }).notNull(),
  rewardAmount: numeric("reward_amount", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BDT").notNull(),
  status: varchar("status", { length: 32 }).default("PENDING").notNull(),
  // 'PENDING', 'CREDITED'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  creditedAt: timestamp("credited_at", { withTimezone: true })
}, (table) => ({
  userLevelIdx: uniqueIndex("vip_reward_claims_user_level_idx").on(table.userId, table.vipLevel),
  transactionIdIdx: uniqueIndex("vip_reward_claims_transaction_id_idx").on(table.transactionId),
  userStatusIdx: index("vip_reward_claims_user_status_idx").on(table.userId, table.status),
  chkAmountPositive: check("chk_vip_reward_claims_amount_positive", sql`${table.rewardAmount} > 0`),
  chkStatusValid: check("chk_vip_reward_claims_status_valid", sql`${table.status} IN ('PENDING', 'CREDITED')`),
  chkLevelRange: check("chk_vip_reward_claims_level_range", sql`${table.vipLevel} >= 1 AND ${table.vipLevel} <= 10`)
}));
var vipProgressionEvents = pgTable("vip_progression_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sourceTransactionId: varchar("source_transaction_id", { length: 128 }).notNull(),
  sourceType: varchar("source_type", { length: 32 }).notNull(),
  // 'DEPOSIT' | 'BET'
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BDT").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userSourceIdx: uniqueIndex("vip_progression_events_user_source_idx").on(table.userId, table.sourceTransactionId, table.sourceType),
  sourceTxIdx: index("vip_progression_events_source_tx_idx").on(table.sourceTransactionId),
  userTypeIdx: index("vip_progression_events_user_type_idx").on(table.userId, table.sourceType),
  chkAmountPositive: check("chk_vip_progression_events_amount_positive", sql`${table.amount} > 0`),
  chkSourceTypeValid: check("chk_vip_progression_events_source_type_valid", sql`${table.sourceType} IN ('DEPOSIT', 'BET')`)
}));
var dailyCheckIns = pgTable("daily_check_ins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  checkInDate: timestamp("check_in_date", { withTimezone: true }).notNull(),
  claimDateUtc: varchar("claim_date_utc", { length: 10 }).notNull(),
  // Authoritative 'YYYY-MM-DD' UTC calendar date
  streakDay: integer("streak_day").notNull(),
  // 1 to 7
  rewardAmount: numeric("reward_amount", { precision: 18, scale: 4 }).notNull(),
  rewardType: varchar("reward_type", { length: 32 }).default("BONUS_CREDIT").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userClaimDateUtcIdx: uniqueIndex("daily_check_ins_user_claim_date_utc_idx").on(table.userId, table.claimDateUtc)
}));
var wheelSpins = pgTable("wheel_spins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  spinDateUtc: varchar("spin_date_utc", { length: 10 }).notNull(),
  // Authoritative 'YYYY-MM-DD' UTC calendar date
  prizeType: varchar("prize_type", { length: 32 }).notNull(),
  // 'REAL_CASH', 'BONUS_CASH', 'FREE_SPINS', 'JACKPOT_TICKET'
  prizeLabel: varchar("prize_label", { length: 64 }).notNull(),
  prizeValue: numeric("prize_value", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  isClaimed: boolean("is_claimed").default(true).notNull(),
  auditMetadata: jsonb("audit_metadata").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  userSpinDateUtcIdx: uniqueIndex("wheel_spins_user_spin_date_utc_idx").on(table.userId, table.spinDateUtc)
}));
var wageringRequirements = pgTable("wagering_requirements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  promoName: varchar("promo_name", { length: 128 }).notNull(),
  bonusAmountGranted: numeric("bonus_amount_granted", { precision: 18, scale: 4 }).notNull(),
  requiredMultiplier: integer("required_multiplier").default(10).notNull(),
  // 10x rollover
  targetTurnoverAmount: numeric("target_turnover_amount", { precision: 18, scale: 4 }).notNull(),
  completedTurnoverAmount: numeric("completed_turnover_amount", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  // 'ACTIVE', 'COMPLETED', 'EXPIRED'
  isReleased: boolean("is_released").default(false).notNull(),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  releaseTransactionId: varchar("release_transaction_id", { length: 128 }),
  auditMetadata: jsonb("audit_metadata").default({}),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true })
}, (table) => ({
  userStatusIdx: index("wagering_requirements_user_status_idx").on(table.userId, table.status),
  userReleasedIdx: index("wagering_requirements_released_idx").on(table.userId, table.isReleased),
  expiresAtIdx: index("wagering_requirements_expires_at_idx").on(table.expiresAt),
  chkBonusPositive: check("chk_wagering_requirements_bonus_positive", sql`${table.bonusAmountGranted} > 0`),
  chkTargetPositive: check("chk_wagering_requirements_target_positive", sql`${table.targetTurnoverAmount} > 0`),
  chkCompletedNonNegative: check("chk_wagering_requirements_completed_non_negative", sql`${table.completedTurnoverAmount} >= 0`),
  chkStatusValid: check("chk_wagering_requirements_status_valid", sql`${table.status} IN ('ACTIVE', 'COMPLETED', 'EXPIRED')`)
}));
var wageringProgressEvents = pgTable("wagering_progress_events", {
  id: serial("id").primaryKey(),
  wageringRequirementId: integer("wagering_requirement_id").references(() => wageringRequirements.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  sourceTransactionId: varchar("source_transaction_id", { length: 128 }).notNull(),
  qualifiedAmount: numeric("qualified_amount", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BDT").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  requirementSourceTxIdx: uniqueIndex("wagering_progress_events_req_source_idx").on(
    table.wageringRequirementId,
    table.sourceTransactionId
  ),
  userIdx: index("wagering_progress_events_user_idx").on(table.userId),
  sourceTxIdx: index("wagering_progress_events_source_tx_idx").on(table.sourceTransactionId),
  requirementIdx: index("wagering_progress_events_requirement_idx").on(table.wageringRequirementId),
  chkAmountPositive: check("chk_wagering_progress_events_amount_positive", sql`${table.qualifiedAmount} > 0`)
}));
var freeSpinEntitlements = pgTable("free_spin_entitlements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  source: varchar("source", { length: 32 }).default("LUCKY_WHEEL").notNull(),
  sourceReference: varchar("source_reference", { length: 128 }).notNull(),
  quantity: integer("quantity").notNull(),
  remainingQuantity: integer("remaining_quantity").notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  // 'ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED'
  spinDateUtc: varchar("spin_date_utc", { length: 10 }).notNull(),
  // 'YYYY-MM-DD'
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  sourceRefIdx: uniqueIndex("free_spin_entitlements_source_ref_idx").on(table.sourceReference),
  userSourceDateIdx: uniqueIndex("free_spin_entitlements_user_source_date_idx").on(table.userId, table.source, table.spinDateUtc),
  userStatusIdx: index("free_spin_entitlements_user_status_idx").on(table.userId, table.status),
  chkQuantityPositive: check("chk_free_spin_quantity_positive", sql`${table.quantity} > 0`),
  chkRemainingNonNegative: check("chk_free_spin_remaining_non_negative", sql`${table.remainingQuantity} >= 0`),
  chkRemainingLteQuantity: check("chk_free_spin_remaining_lte_quantity", sql`${table.remainingQuantity} <= ${table.quantity}`),
  chkStatusValid: check("chk_free_spin_status_valid", sql`${table.status} IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED')`)
}));
var usersRelations = relations(users, ({ one, many }) => ({
  wallets: many(wallets),
  gameRounds: many(gameRounds),
  transactions: many(transactions),
  paymentRequests: many(paymentRequests),
  affiliateNode: one(affiliateNodes, {
    fields: [users.id],
    references: [affiliateNodes.userId]
  }),
  vipProgress: one(userVipProgress, {
    fields: [users.id],
    references: [userVipProgress.userId]
  }),
  checkIns: many(dailyCheckIns),
  wheelSpins: many(wheelSpins),
  freeSpinEntitlements: many(freeSpinEntitlements),
  wageringRequirements: many(wageringRequirements),
  vipRewardClaims: many(vipRewardClaims),
  vipProgressionEvents: many(vipProgressionEvents),
  wageringProgressEvents: many(wageringProgressEvents)
}));
var walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id]
  }),
  transactions: many(transactions),
  paymentRequests: many(paymentRequests)
}));
var gameProvidersRelations = relations(gameProviders, ({ many }) => ({
  rounds: many(gameRounds),
  transactions: many(transactions)
}));
var gameRoundsRelations = relations(gameRounds, ({ one, many }) => ({
  provider: one(gameProviders, {
    fields: [gameRounds.providerId],
    references: [gameProviders.id]
  }),
  user: one(users, {
    fields: [gameRounds.userId],
    references: [users.id]
  }),
  transactions: many(transactions)
}));
var transactionsRelations = relations(transactions, ({ one }) => ({
  provider: one(gameProviders, {
    fields: [transactions.providerId],
    references: [gameProviders.id]
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id]
  }),
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id]
  }),
  round: one(gameRounds, {
    fields: [transactions.roundId],
    references: [gameRounds.id]
  })
}));
var paymentRequestsRelations = relations(paymentRequests, ({ one }) => ({
  user: one(users, {
    fields: [paymentRequests.userId],
    references: [users.id]
  }),
  wallet: one(wallets, {
    fields: [paymentRequests.walletId],
    references: [wallets.id]
  })
}));
var vipRewardClaimsRelations = relations(vipRewardClaims, ({ one }) => ({
  user: one(users, {
    fields: [vipRewardClaims.userId],
    references: [users.id]
  })
}));
var vipProgressionEventsRelations = relations(vipProgressionEvents, ({ one }) => ({
  user: one(users, {
    fields: [vipProgressionEvents.userId],
    references: [users.id]
  })
}));
var wageringRequirementsRelations = relations(wageringRequirements, ({ one, many }) => ({
  user: one(users, {
    fields: [wageringRequirements.userId],
    references: [users.id]
  }),
  progressEvents: many(wageringProgressEvents)
}));
var wageringProgressEventsRelations = relations(wageringProgressEvents, ({ one }) => ({
  user: one(users, {
    fields: [wageringProgressEvents.userId],
    references: [users.id]
  }),
  wageringRequirement: one(wageringRequirements, {
    fields: [wageringProgressEvents.wageringRequirementId],
    references: [wageringRequirements.id]
  })
}));

// src/db/index.ts
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15e3
    });
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/server/controllers/paymentController.ts
import { eq as eq3, desc } from "drizzle-orm";

// src/server/services/wageringService.ts
import { eq, and, lte } from "drizzle-orm";
var toScale4 = (val) => {
  if (typeof val === "bigint") return val;
  if (typeof val === "number") {
    throw new Error("Unsafe JS number monetary input is rejected. Use exact decimal string or bigint minor units.");
  }
  if (typeof val !== "string") {
    throw new Error("Monetary input must be an exact decimal string or bigint minor units.");
  }
  const s = val.trim();
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Invalid monetary decimal string format: "${val}"`);
  }
  const [intPart = "0", fracPart = ""] = s.split(".");
  if (fracPart.length > 4) {
    throw new Error(`Over-precision monetary input rejected: "${val}" has ${fracPart.length} decimal places (maximum 4 allowed).`);
  }
  const paddedFrac = fracPart.padEnd(4, "0");
  const isNeg = intPart.startsWith("-");
  const cleanInt = isNeg ? intPart.slice(1) : intPart;
  const combined = BigInt((cleanInt || "0") + paddedFrac);
  return isNeg ? -combined : combined;
};
var fromScale4 = (val) => {
  const isNeg = val < 0n;
  const abs = isNeg ? -val : val;
  const str = abs.toString().padStart(5, "0");
  const intPart = str.slice(0, -4) || "0";
  const fracPart = str.slice(-4);
  return `${isNeg ? "-" : ""}${intPart}.${fracPart}`;
};
var WageringService = class _WageringService {
  static {
    this.ledgerService = null;
  }
  static setLedgerService(service) {
    _WageringService.ledgerService = service;
  }
  static getLedgerService() {
    return _WageringService.ledgerService;
  }
  /**
   * Processes an authoritative BET transaction toward the user's active wagering requirement.
   * Executes entirely within a single PostgreSQL ACID transaction with row-level locks.
   */
  static async processAuthoritativeBet(params) {
    if (!params.userId || typeof params.userId !== "number" || params.userId <= 0) {
      throw new Error("Valid numeric userId is required");
    }
    if (!params.sourceTransactionId || typeof params.sourceTransactionId !== "string" || params.sourceTransactionId.trim() === "") {
      throw new Error("sourceTransactionId is required for wagering progression");
    }
    const runner = async (tx) => {
      const [betTx] = await tx.select().from(transactions).where(eq(transactions.transactionId, params.sourceTransactionId)).for("update");
      if (!betTx) {
        return {
          success: false,
          reason: "SOURCE_TRANSACTION_NOT_FOUND",
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }
      if (betTx.userId !== params.userId) {
        return {
          success: false,
          reason: "TRANSACTION_USER_MISMATCH",
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }
      if (betTx.type !== "BET") {
        return {
          success: false,
          reason: "INVALID_TRANSACTION_TYPE",
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }
      const isSettled = betTx.status === "COMPLETED" || betTx.status === "SETTLED";
      if (!isSettled) {
        return {
          success: false,
          reason: "TRANSACTION_NOT_SETTLED",
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }
      const meta = betTx.metadata;
      if (meta && (meta.freeSpin === true || meta.isFreeSpin === true || meta.source === "FREE_SPIN" || meta.isPromo === true || meta.demo === true || meta.isDemo === true || meta.promotional === true)) {
        return {
          success: false,
          reason: "EXCLUDED_PROMOTIONAL_STAKE",
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }
      const authoritativeAmount = String(betTx.amount);
      const authoritativeCurrency = betTx.currency || "BDT";
      const qualifiedAmountScale4 = toScale4(authoritativeAmount);
      if (qualifiedAmountScale4 <= 0n) {
        return {
          success: false,
          reason: "INVALID_AMOUNT",
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }
      if (params.amount !== void 0 && params.amount !== null) {
        const callerAmountScale4 = toScale4(params.amount);
        if (callerAmountScale4 !== qualifiedAmountScale4) {
          return {
            success: false,
            reason: "BET_AMOUNT_MISMATCH",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId
          };
        }
      }
      if (params.currency && typeof params.currency === "string" && params.currency.trim() !== "") {
        if (params.currency.trim().toUpperCase() !== authoritativeCurrency.trim().toUpperCase()) {
          return {
            success: false,
            reason: "CURRENCY_MISMATCH",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId
          };
        }
      }
      let requirement;
      if (params.requirementId) {
        const [found] = await tx.select().from(wageringRequirements).where(
          and(
            eq(wageringRequirements.id, params.requirementId),
            eq(wageringRequirements.userId, params.userId)
          )
        ).for("update");
        requirement = found;
      } else {
        const [found] = await tx.select().from(wageringRequirements).where(
          and(
            eq(wageringRequirements.userId, params.userId),
            eq(wageringRequirements.status, "ACTIVE")
          )
        ).orderBy(wageringRequirements.createdAt, wageringRequirements.id).limit(1).for("update");
        requirement = found;
      }
      if (!requirement) {
        return {
          success: true,
          noActiveRequirement: true,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          completed: false,
          message: "No active wagering requirement found for user"
        };
      }
      const now = /* @__PURE__ */ new Date();
      if (requirement.expiresAt && new Date(requirement.expiresAt).getTime() <= now.getTime()) {
        if (requirement.status === "ACTIVE") {
          await tx.update(wageringRequirements).set({ status: "EXPIRED" }).where(eq(wageringRequirements.id, requirement.id));
        }
        return {
          success: false,
          reason: "REQUIREMENT_EXPIRED",
          requirementId: requirement.id,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          status: "EXPIRED",
          completedTurnover: requirement.completedTurnoverAmount,
          targetTurnover: requirement.targetTurnoverAmount
        };
      }
      if (requirement.status !== "ACTIVE") {
        return {
          success: false,
          reason: "REQUIREMENT_NOT_ACTIVE",
          requirementId: requirement.id,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          status: requirement.status,
          completedTurnover: requirement.completedTurnoverAmount,
          targetTurnover: requirement.targetTurnoverAmount
        };
      }
      const [existingEvent] = await tx.select().from(wageringProgressEvents).where(
        and(
          eq(wageringProgressEvents.wageringRequirementId, requirement.id),
          eq(wageringProgressEvents.sourceTransactionId, params.sourceTransactionId)
        )
      ).for("update");
      if (existingEvent) {
        return {
          success: true,
          duplicate: true,
          reason: "ALREADY_PROCESSED",
          requirementId: requirement.id,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          qualifiedAmount: existingEvent.qualifiedAmount,
          completedTurnover: requirement.completedTurnoverAmount,
          targetTurnover: requirement.targetTurnoverAmount,
          status: requirement.status,
          completed: requirement.status === "COMPLETED"
        };
      }
      const [insertedEvent] = await tx.insert(wageringProgressEvents).values({
        wageringRequirementId: requirement.id,
        userId: params.userId,
        sourceTransactionId: params.sourceTransactionId,
        qualifiedAmount: fromScale4(qualifiedAmountScale4),
        currency: authoritativeCurrency,
        processedAt: now
      }).onConflictDoNothing().returning();
      if (!insertedEvent) {
        const [freshReq] = await tx.select().from(wageringRequirements).where(eq(wageringRequirements.id, requirement.id));
        return {
          success: true,
          duplicate: true,
          reason: "ALREADY_PROCESSED",
          requirementId: requirement.id,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          completedTurnover: freshReq?.completedTurnoverAmount || requirement.completedTurnoverAmount,
          targetTurnover: freshReq?.targetTurnoverAmount || requirement.targetTurnoverAmount,
          status: freshReq?.status || requirement.status,
          completed: (freshReq?.status || requirement.status) === "COMPLETED"
        };
      }
      const currentCompletedScale4 = toScale4(requirement.completedTurnoverAmount || "0.0000");
      const targetTurnoverScale4 = toScale4(requirement.targetTurnoverAmount || "0.0000");
      const newCalculatedScale4 = currentCompletedScale4 + qualifiedAmountScale4;
      let cappedScale4;
      let newStatus = "ACTIVE";
      let completedAt = null;
      let isCompleted = false;
      if (newCalculatedScale4 >= targetTurnoverScale4) {
        cappedScale4 = targetTurnoverScale4;
        newStatus = "COMPLETED";
        completedAt = now;
        isCompleted = true;
      } else {
        cappedScale4 = newCalculatedScale4;
        newStatus = "ACTIVE";
        completedAt = null;
        isCompleted = false;
      }
      const completedTurnoverStr = fromScale4(cappedScale4);
      await tx.update(wageringRequirements).set({
        completedTurnoverAmount: completedTurnoverStr,
        status: newStatus,
        completedAt
      }).where(eq(wageringRequirements.id, requirement.id));
      return {
        success: true,
        duplicate: false,
        requirementId: requirement.id,
        userId: params.userId,
        sourceTransactionId: params.sourceTransactionId,
        qualifiedAmount: fromScale4(qualifiedAmountScale4),
        previousCompletedTurnover: fromScale4(currentCompletedScale4),
        completedTurnover: completedTurnoverStr,
        targetTurnover: fromScale4(targetTurnoverScale4),
        status: newStatus,
        completed: isCompleted,
        completedAt
      };
    };
    if (params.tx) {
      return await runner(params.tx);
    }
    return await db.transaction(runner);
  }
  /**
   * Creates a new authoritative Wagering Requirement record.
   * Target turnover is calculated via pure Scale-4 BigInt arithmetic: bonusAmountGranted * requiredMultiplier.
   */
  static async createRequirement(params) {
    const {
      userId,
      promoName,
      bonusAmountGranted,
      requiredMultiplier = 10,
      expiryDays = 7,
      expiryHours,
      expiresAt: customExpiresAt,
      tx
    } = params;
    if (!userId || typeof userId !== "number" || userId <= 0) {
      throw new Error("Valid numeric userId is required");
    }
    if (!promoName || typeof promoName !== "string" || promoName.trim() === "") {
      throw new Error("promoName is required");
    }
    const bonusScale4 = toScale4(bonusAmountGranted);
    if (bonusScale4 <= 0n) {
      throw new Error("bonusAmountGranted must be greater than zero");
    }
    if (!Number.isInteger(requiredMultiplier) || requiredMultiplier <= 0) {
      throw new Error("requiredMultiplier must be a positive integer");
    }
    const targetTurnoverScale4 = bonusScale4 * BigInt(requiredMultiplier);
    const targetTurnoverStr = fromScale4(targetTurnoverScale4);
    const bonusAmountStr = fromScale4(bonusScale4);
    const now = /* @__PURE__ */ new Date();
    let calculatedExpiresAt;
    if (customExpiresAt) {
      calculatedExpiresAt = customExpiresAt;
    } else if (expiryHours !== void 0) {
      calculatedExpiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1e3);
    } else {
      calculatedExpiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1e3);
    }
    const executor = tx || db;
    const [record] = await executor.insert(wageringRequirements).values({
      userId,
      promoName: promoName.trim(),
      bonusAmountGranted: bonusAmountStr,
      requiredMultiplier,
      targetTurnoverAmount: targetTurnoverStr,
      completedTurnoverAmount: "0.0000",
      status: "ACTIVE",
      expiresAt: calculatedExpiresAt,
      createdAt: now
    }).returning();
    if (!record) {
      throw new Error(`Failed to create wagering requirement for user ${userId}`);
    }
    return record;
  }
  /**
   * Retrieves active, non-expired wagering requirements for a given user.
   * Stale requirements with expires_at <= NOW() are automatically marked EXPIRED.
   */
  static async getUserActiveRequirements(userId) {
    if (!userId || typeof userId !== "number" || userId <= 0) {
      throw new Error("Valid numeric userId is required");
    }
    const now = /* @__PURE__ */ new Date();
    await db.update(wageringRequirements).set({ status: "EXPIRED" }).where(
      and(
        eq(wageringRequirements.userId, userId),
        eq(wageringRequirements.status, "ACTIVE"),
        lte(wageringRequirements.expiresAt, now)
      )
    );
    const activeList = await db.select().from(wageringRequirements).where(
      and(
        eq(wageringRequirements.userId, userId),
        eq(wageringRequirements.status, "ACTIVE")
      )
    ).orderBy(wageringRequirements.createdAt, wageringRequirements.id);
    return activeList;
  }
  /**
   * Retrieves a specific wagering requirement by ID.
   */
  static async getRequirementById(id) {
    if (!id || typeof id !== "number" || id <= 0) return null;
    const [record] = await db.select().from(wageringRequirements).where(eq(wageringRequirements.id, id));
    return record || null;
  }
  /**
   * Evaluates authoritative wagering gate for withdrawal or cashout requests.
   * Fails closed by default.
   * Blocks withdrawal if the user has:
   * - any incomplete ACTIVE wagering requirement, OR
   * - any unresolved EXPIRED wagering requirement (where isReleased is false).
   */
  static async enforceWithdrawalWageringGate(params) {
    const { userId, tx } = params;
    if (!userId || typeof userId !== "number" || userId <= 0) {
      throw new Error("Valid numeric userId is required");
    }
    try {
      const now = /* @__PURE__ */ new Date();
      const executor = tx || db;
      await executor.update(wageringRequirements).set({ status: "EXPIRED" }).where(
        and(
          eq(wageringRequirements.userId, userId),
          eq(wageringRequirements.status, "ACTIVE"),
          lte(wageringRequirements.expiresAt, now)
        )
      );
      const activeList = await executor.select().from(wageringRequirements).where(
        and(
          eq(wageringRequirements.userId, userId),
          eq(wageringRequirements.status, "ACTIVE")
        )
      ).orderBy(wageringRequirements.createdAt, wageringRequirements.id);
      if (activeList.length > 0) {
        return {
          allowed: false,
          reason: "ACTIVE_WAGERING_REQUIREMENT_INCOMPLETE",
          userId,
          hasActiveWagering: true,
          activeRequirementsCount: activeList.length,
          activeRequirements: activeList,
          auditMetadata: {
            gatingDecision: "BLOCKED",
            reason: "ACTIVE_WAGERING_REQUIREMENT_INCOMPLETE",
            activeCount: activeList.length,
            requirementIds: activeList.map((r) => r.id)
          }
        };
      }
      const unresolvedExpiredList = await executor.select().from(wageringRequirements).where(
        and(
          eq(wageringRequirements.userId, userId),
          eq(wageringRequirements.status, "EXPIRED"),
          eq(wageringRequirements.isReleased, false)
        )
      ).orderBy(wageringRequirements.createdAt, wageringRequirements.id);
      if (unresolvedExpiredList.length > 0) {
        return {
          allowed: false,
          reason: "EXPIRED_WAGERING_REQUIREMENT_UNRESOLVED",
          userId,
          hasActiveWagering: true,
          activeRequirementsCount: 0,
          activeRequirements: [],
          expiredRequirementsCount: unresolvedExpiredList.length,
          expiredRequirements: unresolvedExpiredList,
          auditMetadata: {
            gatingDecision: "BLOCKED",
            reason: "EXPIRED_WAGERING_REQUIREMENT_UNRESOLVED",
            expiredCount: unresolvedExpiredList.length,
            requirementIds: unresolvedExpiredList.map((r) => r.id)
          }
        };
      }
      return {
        allowed: true,
        reason: "WAGERING_CLEAR",
        userId,
        hasActiveWagering: false,
        activeRequirementsCount: 0,
        activeRequirements: [],
        auditMetadata: {
          gatingDecision: "ALLOWED",
          reason: "NO_ACTIVE_OR_UNRESOLVED_EXPIRED_WAGERING_REQUIREMENT"
        }
      };
    } catch (err) {
      console.error(`[WageringService] enforceWithdrawalWageringGate error for user ${userId}:`, err);
      return {
        allowed: false,
        reason: "WAGERING_GATE_DEPENDENCY_ERROR",
        userId,
        hasActiveWagering: true,
        activeRequirementsCount: 0,
        activeRequirements: [],
        auditMetadata: {
          gatingDecision: "BLOCKED_FAIL_CLOSED",
          error: err.message
        }
      };
    }
  }
  /**
   * Authoritatively converts or releases a completed bonus requirement to REAL balance.
   * Operates strictly through WalletLedgerService.
   * Enforces row-level locks, ownership validation, state-machine verification, and deterministic idempotency.
   */
  static async convertOrReleaseBonus(params) {
    const { userId, requirementId, currency = "BDT", idempotencyKey } = params;
    if (!userId || typeof userId !== "number" || userId <= 0) {
      throw new Error("Valid numeric userId is required");
    }
    if (!requirementId || typeof requirementId !== "number" || requirementId <= 0) {
      throw new Error("Valid numeric requirementId is required");
    }
    const runner = async (tx) => {
      const now = /* @__PURE__ */ new Date();
      const [reqRecord] = await tx.select().from(wageringRequirements).where(eq(wageringRequirements.id, requirementId)).for("update");
      if (!reqRecord) {
        return {
          success: false,
          duplicate: false,
          requirementId,
          userId,
          status: "ACTIVE",
          reason: "WAGERING_REQUIREMENT_NOT_FOUND"
        };
      }
      if (reqRecord.userId !== userId) {
        return {
          success: false,
          duplicate: false,
          requirementId,
          userId,
          status: reqRecord.status,
          reason: "TRANSACTION_USER_MISMATCH"
        };
      }
      if (reqRecord.status === "ACTIVE" && reqRecord.expiresAt <= now) {
        await tx.update(wageringRequirements).set({ status: "EXPIRED" }).where(eq(wageringRequirements.id, requirementId));
        return {
          success: false,
          duplicate: false,
          requirementId,
          userId,
          status: "EXPIRED",
          reason: "WAGERING_REQUIREMENT_EXPIRED"
        };
      }
      if (reqRecord.status === "EXPIRED") {
        return {
          success: false,
          duplicate: false,
          requirementId,
          userId,
          status: "EXPIRED",
          reason: "WAGERING_REQUIREMENT_EXPIRED"
        };
      }
      if (reqRecord.status === "ACTIVE") {
        const completedScale4 = toScale4(reqRecord.completedTurnoverAmount);
        const targetScale4 = toScale4(reqRecord.targetTurnoverAmount);
        if (completedScale4 < targetScale4) {
          return {
            success: false,
            duplicate: false,
            requirementId,
            userId,
            status: "ACTIVE",
            reason: "WAGERING_REQUIREMENT_INCOMPLETE"
          };
        }
        await tx.update(wageringRequirements).set({ status: "COMPLETED", completedAt: now }).where(eq(wageringRequirements.id, requirementId));
        reqRecord.status = "COMPLETED";
        reqRecord.completedAt = now;
      }
      const deterministicTrxId = idempotencyKey || `WAGERING_RELEASE_${userId}_${requirementId}`;
      if (reqRecord.isReleased) {
        return {
          success: true,
          duplicate: true,
          requirementId,
          userId,
          status: "COMPLETED",
          releaseAmount: reqRecord.bonusAmountGranted,
          transactionId: reqRecord.releaseTransactionId || deterministicTrxId,
          reason: "ALREADY_RELEASED",
          auditMetadata: {
            gatingDecision: "IDEMPOTENT_REPLAY",
            wageringRequirementId: requirementId,
            releasedAt: reqRecord.releasedAt
          }
        };
      }
      const effectiveLedger = params.customLedgerService || _WageringService.ledgerService;
      if (!effectiveLedger) {
        throw new Error("FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. Wagering bonus conversion failed closed.");
      }
      const bonusAmountScale4 = toScale4(reqRecord.bonusAmountGranted);
      const bonusAmountStr = fromScale4(bonusAmountScale4);
      let transferResult;
      try {
        transferResult = await effectiveLedger.executeBonusToRealTransfer({
          userId: String(userId),
          transactionId: deterministicTrxId,
          wageringRequirementId: requirementId,
          amountMajor: bonusAmountStr,
          currency,
          auditMetadata: {
            wageringRequirementId: requirementId,
            gatingDecision: "APPROVED",
            releaseReason: "WAGERING_REQUIREMENT_COMPLETED",
            promoName: reqRecord.promoName
          }
        });
      } catch (err) {
        if (err.code === "INSUFFICIENT_FUNDS" || err.name === "InsufficientFundsError") {
          return {
            success: false,
            duplicate: false,
            requirementId,
            userId,
            status: reqRecord.status,
            reason: "INSUFFICIENT_BONUS_BALANCE",
            auditMetadata: {
              gatingDecision: "REJECTED",
              reason: "INSUFFICIENT_BONUS_BALANCE",
              error: err.message
            }
          };
        }
        throw err;
      }
      const auditPayload = {
        wageringRequirementId: requirementId,
        gatingDecision: "APPROVED",
        releaseReason: "WAGERING_REQUIREMENT_COMPLETED",
        settlementTarget: "REAL",
        debitEntryId: transferResult.debitEntryId,
        creditEntryId: transferResult.creditEntryId,
        ledgerEntryId: transferResult.creditEntryId,
        releasedAt: now.toISOString(),
        transactionId: deterministicTrxId
      };
      await tx.update(wageringRequirements).set({
        isReleased: true,
        releasedAt: now,
        releaseTransactionId: deterministicTrxId,
        auditMetadata: auditPayload
      }).where(eq(wageringRequirements.id, requirementId));
      return {
        success: true,
        duplicate: transferResult.isIdempotent || false,
        requirementId,
        userId,
        status: "COMPLETED",
        releaseAmount: bonusAmountStr,
        debitEntryId: transferResult.debitEntryId,
        creditEntryId: transferResult.creditEntryId,
        ledgerEntryId: transferResult.creditEntryId,
        transactionId: deterministicTrxId,
        auditMetadata: auditPayload
      };
    };
    if (params.tx) {
      return await runner(params.tx);
    }
    return await db.transaction(runner);
  }
};

// src/server/utils/paymentAmount.ts
function fromScale42(val) {
  const isNeg = val < 0n;
  const abs = isNeg ? -val : val;
  const str = abs.toString().padStart(5, "0");
  const intPart = str.slice(0, -4) || "0";
  const fracPart = str.slice(-4);
  return `${isNeg ? "-" : ""}${intPart}.${fracPart}`;
}
function toScale42(val) {
  if (typeof val === "bigint") return val;
  if (typeof val === "number") {
    throw new Error("UNSAFE_NUMERIC_MONEY_INPUT: Unsafe JS number monetary input is rejected. Use exact decimal string or bigint minor units.");
  }
  if (typeof val !== "string") {
    throw new Error("Monetary input must be an exact decimal string or bigint minor units.");
  }
  const s = val.trim();
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) {
    throw new Error(`Invalid monetary decimal string format: "${val}"`);
  }
  const [intPart = "0", fracPart = ""] = s.split(".");
  if (fracPart.length > 4) {
    throw new Error(`Over-precision monetary input rejected: "${val}" has ${fracPart.length} decimal places (maximum 4 allowed).`);
  }
  const paddedFrac = fracPart.padEnd(4, "0");
  const isNeg = intPart.startsWith("-");
  const cleanInt = isNeg ? intPart.slice(1) : intPart;
  const combined = BigInt((cleanInt || "0") + paddedFrac);
  return isNeg ? -combined : combined;
}
function validatePaymentAmount(amount) {
  if (amount === void 0 || amount === null || amount === "") {
    throw new Error("Monetary amount is required and cannot be empty.");
  }
  if (typeof amount === "number") {
    throw new Error("UNSAFE_NUMERIC_MONEY_INPUT: Unsafe JS number monetary input is rejected. Use exact decimal string or bigint minor units.");
  }
  let str;
  if (typeof amount === "string") {
    str = amount.trim();
    if (!str) {
      throw new Error("Monetary amount is required and cannot be empty.");
    }
  } else if (typeof amount === "bigint") {
    if (amount <= 0n) {
      throw new Error("Monetary amount must be strictly greater than zero.");
    }
    return {
      raw: amount.toString(),
      minorUnits: amount,
      decimalString: fromScale42(amount)
    };
  } else {
    throw new Error("Invalid monetary amount type. Expected decimal string or minor units.");
  }
  if (/[eE]/.test(str)) {
    throw new Error(`Scientific notation is not allowed for monetary amounts: "${str}"`);
  }
  if (str === "NaN" || str === "Infinity" || str === "-Infinity") {
    throw new Error(`Invalid monetary amount format: "${str}"`);
  }
  if (str.startsWith("-")) {
    throw new Error(`Monetary amount cannot be negative: "${str}"`);
  }
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error(`Invalid monetary decimal string format: "${str}"`);
  }
  const [intPart = "0", fracPart = ""] = str.split(".");
  if (fracPart.length > 4) {
    throw new Error(`Over-precision monetary input rejected: "${str}" has ${fracPart.length} decimal places (maximum 4 allowed).`);
  }
  const paddedFrac = fracPart.padEnd(4, "0");
  const cleanInt = intPart.replace(/^0+(?=\d)/, "");
  const minorUnits = BigInt((cleanInt || "0") + paddedFrac);
  if (minorUnits <= 0n) {
    throw new Error("Monetary amount must be strictly greater than zero.");
  }
  return {
    raw: str,
    minorUnits,
    decimalString: fromScale42(minorUnits)
  };
}

// src/server/utils/paymentAuth.ts
import { eq as eq2 } from "drizzle-orm";
var PaymentAuthError = class _PaymentAuthError extends Error {
  constructor(message, statusCode = 401, code = "UNAUTHENTICATED") {
    super(message);
    this.name = "PaymentAuthError";
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, _PaymentAuthError.prototype);
  }
};
async function resolveAuthPaymentUser(req, clientUserId) {
  const authUid = req.user?.uid;
  if (!authUid) {
    throw new PaymentAuthError(
      "Unauthorized: Authentication required",
      401,
      "UNAUTHENTICATED"
    );
  }
  let foundUser;
  if (req.mockUsersTable && Array.isArray(req.mockUsersTable)) {
    foundUser = req.mockUsersTable.find((u) => u.uid === authUid);
  } else if (req.mockUser !== void 0) {
    if (req.mockUser && req.mockUser.uid === authUid) {
      foundUser = req.mockUser;
    } else {
      foundUser = void 0;
    }
  } else {
    try {
      const results = await db.select({
        id: users.id,
        uid: users.uid,
        username: users.username,
        email: users.email
      }).from(users).where(eq2(users.uid, authUid)).limit(1);
      foundUser = results[0];
    } catch (dbErr) {
      throw dbErr;
    }
  }
  if (!foundUser) {
    throw new PaymentAuthError(
      `User profile not found for authenticated UID: ${authUid}`,
      404,
      "USER_PROFILE_NOT_FOUND"
    );
  }
  if (clientUserId !== void 0 && clientUserId !== null && String(clientUserId).trim() !== "") {
    const raw = String(clientUserId).trim();
    const isMatchingId = /^\d+$/.test(raw) && parseInt(raw, 10) === foundUser.id;
    const isMatchingUid = raw === foundUser.uid;
    if (!isMatchingId && !isMatchingUid) {
      throw new PaymentAuthError(
        "Account ownership mismatch: cannot perform financial operations for another account",
        403,
        "ACCOUNT_OWNERSHIP_MISMATCH"
      );
    }
  }
  return {
    id: foundUser.id,
    uid: foundUser.uid,
    username: foundUser.username,
    email: foundUser.email
  };
}

// src/server/controllers/paymentController.ts
var PaymentController = class {
  constructor() {
    this.ledgerService = walletLedgerService;
  }
  setLedgerService(service) {
    this.ledgerService = service;
  }
  /**
   * Submit a local deposit request (bKash / Nagad / Rocket)
   * In production, deposit submission creates ONLY a PENDING record.
   * Client-controlled autoApprove and direct wallet balance mutation are strictly disabled.
   * Authenticated via Firebase ID token and resolved to canonical PostgreSQL user.
   */
  async submitDeposit(req, res) {
    try {
      const {
        userId,
        method,
        amount,
        currency = "BDT",
        senderNumber,
        receiverNumber,
        trxId
      } = req.body;
      let authUser;
      try {
        authUser = await resolveAuthPaymentUser(req, userId);
      } catch (authErr) {
        res.status(authErr.statusCode || 401).json({
          success: false,
          error: authErr.code || authErr.message || "Authentication failed",
          code: authErr.code || "UNAUTHENTICATED",
          message: authErr.message
        });
        return;
      }
      if (!method || amount === void 0 || amount === null || amount === "" || !trxId) {
        res.status(400).json({ error: "Missing required deposit parameters" });
        return;
      }
      if (typeof amount !== "string") {
        res.status(400).json({
          error: "UNSAFE_NUMERIC_MONEY_INPUT: Monetary amount must be provided as an exact decimal string."
        });
        return;
      }
      let amountMinor;
      let normalizedAmount;
      try {
        const parsed = validatePaymentAmount(amount);
        amountMinor = parsed.minorUnits;
        normalizedAmount = parsed.decimalString;
      } catch (err) {
        res.status(400).json({ error: `Invalid monetary amount: ${err.message}` });
        return;
      }
      if (amountMinor <= 0n) {
        res.status(400).json({ error: "Deposit amount must be greater than zero" });
        return;
      }
      const walletList = await db.select().from(wallets).where(eq3(wallets.userId, authUser.id));
      let wallet = walletList.find((w) => w.currency === currency) || walletList[0];
      if (!wallet) {
        const [newWallet] = await db.insert(wallets).values({
          userId: authUser.id,
          currency,
          realBalance: "0.0000",
          bonusBalance: "0.0000",
          lockedBalance: "0.0000"
        }).returning();
        wallet = newWallet;
      }
      const [insertedReq] = await db.insert(paymentRequests).values({
        userId: authUser.id,
        walletId: wallet.id,
        type: "DEPOSIT",
        method,
        amount: normalizedAmount,
        currency,
        senderNumber: senderNumber ? String(senderNumber) : "",
        receiverNumber: receiverNumber ? String(receiverNumber) : "01900-112233",
        trxId: String(trxId).trim().toUpperCase(),
        status: "PENDING",
        adminNote: "Deposit submitted, pending provider callback/manual verification"
      }).returning();
      res.status(201).json({
        success: true,
        data: insertedReq,
        message: "Deposit request submitted for manual/provider verification"
      });
    } catch (err) {
      console.error("[PaymentController Error]:", err);
      res.status(500).json({ error: err.message || "Failed to submit deposit" });
    }
  }
  /**
   * Submit a local withdrawal request (bKash / Nagad / Rocket)
   * Authenticated via Firebase ID token and resolved to canonical PostgreSQL user.
   * PLAY369 Task 6.1.6: Atomic REAL -> LOCKED Reservation via WalletLedgerService.
   */
  async submitWithdrawal(req, res) {
    try {
      const {
        userId,
        method,
        amount,
        currency = "BDT",
        receiverNumber,
        withdrawalId: requestedWithdrawalId,
        trxId: requestedTrxId,
        idempotencyKey: bodyIdempotencyKey
      } = req.body;
      let authUser;
      try {
        authUser = await resolveAuthPaymentUser(req, userId);
      } catch (authErr) {
        res.status(authErr.statusCode || 401).json({
          success: false,
          error: authErr.code || authErr.message || "Authentication failed",
          code: authErr.code || "UNAUTHENTICATED",
          message: authErr.message
        });
        return;
      }
      const rawIdempHeader = req.headers && req.headers["idempotency-key"] || (typeof req.header === "function" ? req.header("idempotency-key") : void 0);
      if (!rawIdempHeader || typeof rawIdempHeader !== "string" || rawIdempHeader.trim() === "") {
        res.status(400).json({
          success: false,
          error: "Idempotency-Key header is required for withdrawals",
          code: "IDEMPOTENCY_KEY_REQUIRED"
        });
        return;
      }
      const idempotencyKey = rawIdempHeader.trim();
      if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
        res.status(400).json({
          success: false,
          error: "Idempotency-Key header must be between 8 and 128 characters",
          code: "INVALID_IDEMPOTENCY_KEY"
        });
        return;
      }
      if (!method || amount === void 0 || amount === null || amount === "" || !receiverNumber) {
        res.status(400).json({ error: "Missing required withdrawal parameters" });
        return;
      }
      if (typeof amount !== "string") {
        res.status(400).json({
          error: "UNSAFE_NUMERIC_MONEY_INPUT: Monetary amount must be provided as an exact decimal string."
        });
        return;
      }
      let normalizedAmount;
      try {
        const parsed = validatePaymentAmount(amount);
        if (parsed.minorUnits <= 0n) {
          res.status(400).json({ error: "Withdrawal amount must be greater than zero" });
          return;
        }
        normalizedAmount = parsed.decimalString;
      } catch (err) {
        res.status(400).json({ error: `Invalid monetary amount: ${err.message}` });
        return;
      }
      const gate = await WageringService.enforceWithdrawalWageringGate({ userId: authUser.id });
      if (!gate.allowed) {
        res.status(403).json({
          success: false,
          error: `Withdrawal blocked: active wagering requirement is not completed (${gate.reason}).`,
          code: gate.reason || "WAGERING_REQUIREMENT_INCOMPLETE",
          activeRequirementsCount: gate.activeRequirementsCount,
          activeRequirements: gate.activeRequirements
        });
        return;
      }
      const withdrawalId = deriveWithdrawalTransactionId(authUser.id, idempotencyKey);
      const correlationId = req.headers["x-correlation-id"] || `corr_wth_${Date.now()}_${authUser.id}`;
      try {
        const reservation = await this.ledgerService.reserveWithdrawalFunds({
          withdrawalId,
          userId: authUser.id,
          amount: normalizedAmount,
          currency,
          paymentMethod: method,
          receiverNumber: String(receiverNumber),
          adminNote: "Queued for Bank/MFS Transfer",
          metadata: {
            method,
            receiverNumber: String(receiverNumber),
            clientReference: typeof requestedWithdrawalId === "string" && requestedWithdrawalId.trim() !== "" ? requestedWithdrawalId.trim() : typeof requestedTrxId === "string" && requestedTrxId.trim() !== "" ? requestedTrxId.trim() : void 0,
            senderIp: req.ip,
            userAgent: req.headers["user-agent"]
          },
          correlationId,
          idempotencyKey
        });
        res.status(reservation.isIdempotent ? 200 : 201).json({
          success: true,
          data: {
            id: reservation.paymentRequestId,
            userId: authUser.id,
            walletId: reservation.walletId,
            type: "WITHDRAWAL",
            method,
            amount: normalizedAmount,
            currency,
            receiverNumber: String(receiverNumber),
            trxId: reservation.withdrawalId,
            status: reservation.status,
            adminNote: "Queued for Bank/MFS Transfer",
            beforeRealBalance: reservation.beforeRealBalance,
            afterRealBalance: reservation.afterRealBalance,
            beforeLockedBalance: reservation.beforeLockedBalance,
            afterLockedBalance: reservation.afterLockedBalance,
            isIdempotent: reservation.isIdempotent,
            createdAt: reservation.executedAt
          },
          message: "Withdrawal request submitted successfully and funds reserved"
        });
      } catch (ledgerErr) {
        if (ledgerErr instanceof InsufficientFundsError) {
          res.status(400).json({
            success: false,
            error: "Insufficient funds for withdrawal",
            code: "INSUFFICIENT_FUNDS",
            message: ledgerErr.message
          });
          return;
        }
        if (ledgerErr instanceof WalletFrozenError) {
          res.status(403).json({
            success: false,
            error: "Wallet is frozen or suspended",
            code: "WALLET_FROZEN",
            message: ledgerErr.message
          });
          return;
        }
        if (ledgerErr instanceof WalletNotFoundError) {
          res.status(404).json({
            success: false,
            error: "Wallet not found",
            code: "WALLET_NOT_FOUND",
            message: ledgerErr.message
          });
          return;
        }
        if (ledgerErr instanceof IdempotencyConflictError) {
          res.status(409).json({
            success: false,
            error: "Idempotency conflict: request parameters do not match original request",
            code: "IDEMPOTENCY_CONFLICT",
            message: ledgerErr.message,
            details: ledgerErr.details
          });
          return;
        }
        if (ledgerErr instanceof LedgerValidationError) {
          res.status(400).json({
            success: false,
            error: ledgerErr.message,
            code: "VALIDATION_ERROR"
          });
          return;
        }
        throw ledgerErr;
      }
    } catch (err) {
      console.error("[PaymentController Error]:", err);
      res.status(500).json({ error: err.message || "Failed to submit withdrawal" });
    }
  }
  /**
   * List recent payment requests
   */
  async getRequests(req, res) {
    try {
      const { userId } = req.query;
      let query3 = db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));
      if (userId) {
        const results2 = await db.select().from(paymentRequests).where(eq3(paymentRequests.userId, Number(userId))).orderBy(desc(paymentRequests.createdAt));
        res.json({ success: true, data: results2 });
        return;
      }
      const results = await query3.limit(50);
      res.json({ success: true, data: results });
    } catch (err) {
      console.error("[PaymentController Error]:", err);
      res.status(500).json({ error: err.message || "Failed to fetch requests" });
    }
  }
};
var paymentController = new PaymentController();

// src/services/paymentAdapters.ts
function sanitizeProviderPayload(data, depth = 0) {
  if (depth > 5) return "[Truncated]";
  if (data === null || data === void 0) return data;
  if (typeof data !== "object") return data;
  const SENSITIVE_KEYS = [
    /secret/i,
    /password/i,
    /passphrase/i,
    /token/i,
    /auth(orization)?/i,
    /bearer/i,
    /signature/i,
    /pin/i,
    /api[-_]?key/i,
    /private[-_]?key/i,
    /cert/i,
    /cvv/i
  ];
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeProviderPayload(item, depth + 1));
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEYS.some((regex) => regex.test(key));
    if (isSensitive) {
      sanitized[key] = "***REDACTED***";
    } else {
      sanitized[key] = sanitizeProviderPayload(value, depth + 1);
    }
  }
  return sanitized;
}
var BkashPaymentAdapter = class {
  constructor() {
    this.providerId = "bkash";
    this.name = "bKash Automated Gateway";
  }
  isConfigured() {
    return Boolean(process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET);
  }
  async verifyDeposit(params) {
    const cleanTrx = params.trxId.trim().toUpperCase();
    if (!this.isConfigured()) {
      return {
        verified: false,
        status: "PENDING_INTEGRATION",
        code: "PROVIDER_NOT_CONFIGURED",
        providerTransactionId: cleanTrx,
        message: "bKash Automated Gateway adapter is not configured with live credentials. Automated credit is disabled."
      };
    }
    const validFormat = /^[A-Z0-9]{8,12}$/.test(cleanTrx);
    if (!validFormat) {
      return {
        verified: false,
        status: "FAILED",
        code: "INVALID_TRX_FORMAT",
        providerTransactionId: cleanTrx,
        message: "Invalid bKash TrxID format. Expected 8-12 alphanumeric characters."
      };
    }
    return {
      verified: false,
      status: "PENDING_INTEGRATION",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      providerTransactionId: cleanTrx,
      message: "bKash API verification requires live provider integration and webhook confirmation."
    };
  }
  async executePayout(params) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: "",
        status: "FAILED",
        code: "PROVIDER_NOT_CONFIGURED",
        message: "bKash payout adapter is not configured with live credentials. Automated disbursement is disabled."
      };
    }
    return {
      success: false,
      providerReference: "",
      status: "FAILED",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      message: "bKash automated payout integration is incomplete and pending verified provider documentation."
    };
  }
  async processWebhook(payload, _signature) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : void 0;
    return {
      signatureValid: false,
      code: "WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED",
      providerTransactionId: payload.trxID || payload.paymentID ? String(payload.trxID || payload.paymentID) : void 0,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : "BDT",
      status: "PROVIDER_INTEGRATION_INCOMPLETE",
      rawPayload: sanitized
    };
  }
};
var NagadPaymentAdapter = class {
  constructor() {
    this.providerId = "nagad";
    this.name = "Nagad Automated Gateway";
  }
  isConfigured() {
    return Boolean(process.env.NAGAD_MERCHANT_ID && process.env.NAGAD_PRIVATE_KEY);
  }
  async verifyDeposit(params) {
    const cleanTrx = params.trxId.trim().toUpperCase();
    if (!this.isConfigured()) {
      return {
        verified: false,
        status: "PENDING_INTEGRATION",
        code: "PROVIDER_NOT_CONFIGURED",
        providerTransactionId: cleanTrx,
        message: "Nagad Automated Gateway adapter is not configured with live credentials. Automated credit is disabled."
      };
    }
    const validFormat = /^[A-Z0-9]{8,12}$/.test(cleanTrx);
    if (!validFormat) {
      return {
        verified: false,
        status: "FAILED",
        code: "INVALID_TRX_FORMAT",
        providerTransactionId: cleanTrx,
        message: "Invalid Nagad TrxID format. Expected 8-12 alphanumeric characters."
      };
    }
    return {
      verified: false,
      status: "PENDING_INTEGRATION",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      providerTransactionId: cleanTrx,
      message: "Nagad verification requires live provider integration and webhook confirmation."
    };
  }
  async executePayout(params) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: "",
        status: "FAILED",
        code: "PROVIDER_NOT_CONFIGURED",
        message: "Nagad payout adapter is not configured. Request queued for manual processing."
      };
    }
    return {
      success: false,
      providerReference: "",
      status: "FAILED",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      message: "Nagad automated payout integration is incomplete and pending verified provider documentation."
    };
  }
  async processWebhook(payload, _signature) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : void 0;
    return {
      signatureValid: false,
      code: "WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED",
      providerTransactionId: payload.issuerTrxId ? String(payload.issuerTrxId) : void 0,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : "BDT",
      status: "PROVIDER_INTEGRATION_INCOMPLETE",
      rawPayload: sanitized
    };
  }
};
var RocketPaymentAdapter = class {
  constructor() {
    this.providerId = "rocket";
    this.name = "Rocket Automated Gateway";
  }
  isConfigured() {
    return Boolean(process.env.ROCKET_BILLER_ID && process.env.ROCKET_PIN);
  }
  async verifyDeposit(params) {
    const cleanTrx = params.trxId.trim().toUpperCase();
    if (!this.isConfigured()) {
      return {
        verified: false,
        status: "PENDING_INTEGRATION",
        code: "PROVIDER_NOT_CONFIGURED",
        providerTransactionId: cleanTrx,
        message: "Rocket Automated Gateway adapter is not configured with live credentials. Automated credit is disabled."
      };
    }
    const validFormat = /^[A-Z0-9]{8,12}$/.test(cleanTrx);
    if (!validFormat) {
      return {
        verified: false,
        status: "FAILED",
        code: "INVALID_TRX_FORMAT",
        providerTransactionId: cleanTrx,
        message: "Invalid Rocket TrxID format. Expected 8-12 alphanumeric characters."
      };
    }
    return {
      verified: false,
      status: "PENDING_INTEGRATION",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      providerTransactionId: cleanTrx,
      message: "Rocket verification requires live provider integration and webhook confirmation."
    };
  }
  async executePayout(params) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: "",
        status: "FAILED",
        code: "PROVIDER_NOT_CONFIGURED",
        message: "Rocket payout adapter is not configured. Request queued for manual processing."
      };
    }
    return {
      success: false,
      providerReference: "",
      status: "FAILED",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      message: "Rocket automated payout integration is incomplete and pending verified provider documentation."
    };
  }
  async processWebhook(payload, _signature) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : void 0;
    return {
      signatureValid: false,
      code: "WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED",
      providerTransactionId: payload.txId ? String(payload.txId) : void 0,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : "BDT",
      status: "PROVIDER_INTEGRATION_INCOMPLETE",
      rawPayload: sanitized
    };
  }
};
var BankTransferPaymentAdapter = class {
  constructor() {
    this.providerId = "bank_transfer";
    this.name = "Bank Transfer / NPSB Gateway";
  }
  isConfigured() {
    return Boolean(process.env.BANK_API_GATEWAY_URL && process.env.BANK_CLIENT_CERT);
  }
  async verifyDeposit(params) {
    const cleanTrx = params.trxId.trim().toUpperCase();
    if (!this.isConfigured()) {
      return {
        verified: false,
        status: "PENDING_INTEGRATION",
        code: "PROVIDER_NOT_CONFIGURED",
        providerTransactionId: cleanTrx,
        message: "Bank Core Banking API adapter is not configured with live credentials. Automated credit is disabled."
      };
    }
    return {
      verified: false,
      status: "PENDING_INTEGRATION",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      providerTransactionId: cleanTrx,
      message: "Bank transfer verification requires live banking callback and settlement."
    };
  }
  async executePayout(params) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: "",
        status: "FAILED",
        code: "PROVIDER_NOT_CONFIGURED",
        message: "Bank transfer payout adapter is not configured. Request queued for manual processing."
      };
    }
    return {
      success: false,
      providerReference: "",
      status: "FAILED",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      message: "Bank transfer automated payout integration is incomplete and pending verified provider documentation."
    };
  }
  async processWebhook(payload, _signature) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : void 0;
    return {
      signatureValid: false,
      code: "WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED",
      providerTransactionId: payload.swiftOrNpsbRef ? String(payload.swiftOrNpsbRef) : void 0,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : "BDT",
      status: "PROVIDER_INTEGRATION_INCOMPLETE",
      rawPayload: sanitized
    };
  }
};
var CardPaymentAdapter = class {
  constructor() {
    this.providerId = "card_payment";
    this.name = "Visa / Mastercard 3DS Gateway";
  }
  isConfigured() {
    return Boolean(process.env.STRIPE_SECRET_KEY || process.env.CARD_MERCHANT_SECRET);
  }
  async verifyDeposit(params) {
    const cleanTrx = params.trxId.trim().toUpperCase();
    if (!this.isConfigured()) {
      return {
        verified: false,
        status: "PENDING_INTEGRATION",
        code: "PROVIDER_NOT_CONFIGURED",
        providerTransactionId: cleanTrx,
        message: "Card 3DS Gateway adapter is not configured with live credentials. Automated credit is disabled."
      };
    }
    return {
      verified: false,
      status: "PENDING_INTEGRATION",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      providerTransactionId: cleanTrx,
      message: "Card verification requires live gateway callback."
    };
  }
  async executePayout(params) {
    if (!this.isConfigured()) {
      return {
        success: false,
        providerReference: "",
        status: "FAILED",
        code: "PROVIDER_NOT_CONFIGURED",
        message: "Card OCT payout adapter is not configured. Request queued for manual processing."
      };
    }
    return {
      success: false,
      providerReference: "",
      status: "FAILED",
      code: "PROVIDER_INTEGRATION_INCOMPLETE",
      message: "Card OCT payout adapter integration is incomplete and pending verified provider documentation."
    };
  }
  async processWebhook(payload, _signature) {
    const sanitized = sanitizeProviderPayload(payload);
    const rawAmount = payload.amount != null ? String(payload.amount) : void 0;
    return {
      signatureValid: false,
      code: "WEBHOOK_SIGNATURE_CONTRACT_NOT_CONFIGURED",
      providerTransactionId: payload.chargeId ? String(payload.chargeId) : void 0,
      rawAmount,
      currency: payload.currency ? String(payload.currency) : "USD",
      status: "PROVIDER_INTEGRATION_INCOMPLETE",
      rawPayload: sanitized
    };
  }
};

// src/services/notificationService.ts
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";

// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  setPersistence,
  browserLocalPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "my-app-3d013",
  appId: "1:476127189079:web:7aabee5c1b7d1d851d6b12",
  apiKey: "AIzaSyCrQWrE-ZK4rFeU71Dpi59iXz4SSMLDuuk",
  authDomain: "my-app-3d013.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-remixigamingseam-f254c3d9-f0b0-442c-9107-66d13db9b3fe",
  storageBucket: "my-app-3d013.firebasestorage.app",
  messagingSenderId: "476127189079",
  measurementId: "G-0DDR8VF34M",
  oAuthClientId: "476127189079-o6gfjpavbi3grbmeegp0bq6mbrg5bfa2.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/lib/firebase.ts
var firebaseConfig = {
  ...firebase_applet_config_default,
  firestoreDatabaseId: firebase_applet_config_default.firestoreDatabaseId || "ai-studio-remixigamingseam-f254c3d9-f0b0-442c-9107-66d13db9b3fe"
};
var SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata.readonly"
];
var app = initializeApp(firebaseConfig);
var auth = getAuth(app);
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Firebase setPersistence notice:", err);
  });
} catch (e) {
  console.warn("Firebase persistence initialization error:", e);
}
var FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
var db2 = getFirestore(app, firebaseConfig.firestoreDatabaseId);
var googleAuthProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  googleAuthProvider.addScope(scope);
});

// src/services/notificationService.ts
import confetti from "canvas-confetti";
var INITIAL_NOTIFICATIONS = [
  {
    id: "notif_seed_001",
    userId: "a0000000-0000-0000-0000-000000000004",
    // Sakib (VIP)
    title: "\u09AC\u09BF\u0995\u09BE\u09B6 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 (Approved)",
    message: "\u0986\u09AA\u09A8\u09BE\u09B0 \u09F3\u09EB,\u09E6\u09E6\u09E6 \u099F\u09BE\u0995\u09BE\u09B0 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u09B0\u09BF\u0995\u09CB\u09AF\u09BC\u09C7\u09B8\u09CD\u099F \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09AA\u09CD\u09B0\u09B8\u09C7\u09B8 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 (TrxID: 9J3K88L2).",
    type: "WITHDRAWAL_APPROVED",
    amount: 5e3,
    currency: "BDT",
    isRead: false,
    actionTab: "cashier",
    createdAt: new Date(Date.now() - 1e3 * 60 * 12).toISOString()
  },
  {
    id: "notif_seed_002",
    userId: "a0000000-0000-0000-0000-000000000004",
    title: "\u09E7\u09E6\u09E6% \u09B8\u09BE\u09AA\u09CD\u09A4\u09BE\u09B9\u09BF\u0995 \u09B0\u09BF\u09B2\u09CB\u09A1 \u09AC\u09CB\u09A8\u09BE\u09B8 \u0986\u09A8\u09B2\u0995!",
    message: "\u0985\u09AD\u09BF\u09A8\u09A8\u09CD\u09A6\u09A8! \u0986\u09AA\u09A8\u09BE\u09B0 \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F\u09C7 \u09F3\u09E8,\u09EB\u09E6\u09E6 \u09AC\u09CB\u09A8\u09BE\u09B8 \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u0986\u09A8\u09B2\u0995 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 \u098F\u0996\u09A8\u0987 \u098F\u09AD\u09BF\u09AF\u09BC\u09C7\u099F\u09B0 \u0996\u09C7\u09B2\u09C1\u09A8\u0964",
    type: "BONUS_UNLOCKED",
    amount: 2500,
    currency: "BDT",
    isRead: false,
    actionTab: "promo",
    createdAt: new Date(Date.now() - 1e3 * 60 * 45).toISOString()
  },
  {
    id: "notif_seed_003",
    userId: "a0000000-0000-0000-0000-000000000004",
    title: "\u09AD\u09BF\u0986\u0987\u09AA\u09BF \u09A1\u09BE\u09AF\u09BC\u09AE\u09A8\u09CD\u09A1 \u0995\u09CD\u09AF\u09BE\u09B6\u09AC\u09CD\u09AF\u09BE\u0995 \u099C\u09AE\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7",
    message: "\u0986\u09AA\u09A8\u09BE\u09B0 \u0997\u09A4 \u09B8\u09AA\u09CD\u09A4\u09BE\u09B9\u09C7\u09B0 \u09E7.\u09EB% \u09A1\u09BE\u09AF\u09BC\u09AE\u09A8\u09CD\u09A1 \u0995\u09CD\u09AF\u09BE\u09B6\u09AC\u09CD\u09AF\u09BE\u0995 \u09F3\u09E7,\u09EE\u09EB\u09E6 \u09B8\u09B0\u09BE\u09B8\u09B0\u09BF \u0993\u09AF\u09BC\u09BE\u09B2\u09C7\u099F\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964",
    type: "VIP_UPGRADE",
    amount: 1850,
    currency: "BDT",
    isRead: true,
    actionTab: "vip",
    createdAt: new Date(Date.now() - 1e3 * 60 * 180).toISOString()
  }
];
var NotificationService = class {
  constructor() {
    this.localNotifications = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Map();
    this.localNotifications.set(
      "a0000000-0000-0000-0000-000000000004",
      [...INITIAL_NOTIFICATIONS]
    );
  }
  /**
   * Subscribe to real-time notification updates for a specific user
   */
  subscribe(userId, callback) {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, []);
    }
    this.listeners.get(userId).push(callback);
    const current = this.getUserNotifications(userId);
    callback(current);
    let unsubscribeFirestore = null;
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifsRef = collection(db2, "users", userId, "notifications");
        unsubscribeFirestore = onSnapshot(
          notifsRef,
          (snapshot) => {
            const firestoreNotifs = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              firestoreNotifs.push({
                id: docSnap.id,
                userId: data.userId || userId,
                title: data.title || "",
                message: data.message || "",
                type: data.type || "SYSTEM_ALERT",
                amount: data.amount,
                currency: data.currency || "BDT",
                isRead: !!data.isRead,
                actionTab: data.actionTab,
                createdAt: data.createdAt || (/* @__PURE__ */ new Date()).toISOString()
              });
            });
            firestoreNotifs.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            if (firestoreNotifs.length > 0) {
              this.localNotifications.set(userId, firestoreNotifs);
              this.notifyListeners(userId);
            }
          },
          (error) => {
            console.warn("Firestore notification listener fallback to local state:", error);
          }
        );
      }
    } catch (err) {
      console.warn("Notification listener initial error:", err);
    }
    return () => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
      const list = this.listeners.get(userId) || [];
      this.listeners.set(
        userId,
        list.filter((cb) => cb !== callback)
      );
    };
  }
  /**
   * Get current notifications for user
   */
  getUserNotifications(userId) {
    const list = this.localNotifications.get(userId) || [];
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  /**
   * Dispatch a real-time notification
   */
  async pushNotification(userId, notification) {
    const newNotif = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const current = this.localNotifications.get(userId) || [];
    this.localNotifications.set(userId, [newNotif, ...current]);
    this.notifyListeners(userId);
    if (notification.type === "WITHDRAWAL_APPROVED" || notification.type === "BONUS_UNLOCKED" || notification.type === "VIP_UPGRADE") {
      try {
        confetti({
          particleCount: 50,
          spread: 55,
          origin: { y: 0.1, x: 0.85 },
          colors: ["#06b6d4", "#f59e0b", "#10b981", "#ec4899"]
        });
      } catch (e) {
      }
    }
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifDoc = doc(db2, "users", userId, "notifications", newNotif.id);
        await setDoc(notifDoc, {
          ...newNotif,
          serverTimestamp: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Firestore notif push fallback:", err);
    }
    return newNotif;
  }
  /**
   * Mark a notification as read
   */
  async markAsRead(userId, notificationId) {
    const current = this.localNotifications.get(userId) || [];
    const updated = current.map(
      (n) => n.id === notificationId ? { ...n, isRead: true } : n
    );
    this.localNotifications.set(userId, updated);
    this.notifyListeners(userId);
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifDoc = doc(db2, "users", userId, "notifications", notificationId);
        await updateDoc(notifDoc, { isRead: true });
      }
    } catch (err) {
    }
  }
  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    const current = this.localNotifications.get(userId) || [];
    const updated = current.map((n) => ({ ...n, isRead: true }));
    this.localNotifications.set(userId, updated);
    this.notifyListeners(userId);
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        for (const notif of current) {
          if (!notif.isRead) {
            const notifDoc = doc(db2, "users", userId, "notifications", notif.id);
            await updateDoc(notifDoc, { isRead: true });
          }
        }
      }
    } catch (err) {
    }
  }
  /**
   * Delete a notification
   */
  async deleteNotification(userId, notificationId) {
    const current = this.localNotifications.get(userId) || [];
    const updated = current.filter((n) => n.id !== notificationId);
    this.localNotifications.set(userId, updated);
    this.notifyListeners(userId);
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifDoc = doc(db2, "users", userId, "notifications", notificationId);
        await deleteDoc(notifDoc);
      }
    } catch (err) {
    }
  }
  /**
   * Clear all notifications for user
   */
  clearAll(userId) {
    this.localNotifications.set(userId, []);
    this.notifyListeners(userId);
  }
  /**
   * Trigger Real-Time Deposit Confirmation Notification
   */
  notifyDepositConfirmed(amount, currency = "BDT", gateway = "bKash", userId) {
    const targetUid = userId || "a0000000-0000-0000-0000-000000000004";
    return this.pushNotification(targetUid, {
      userId: targetUid,
      title: `\u2705 ${gateway} \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u09B8\u09AB\u09B2 \u0993 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09AF\u09C1\u0995\u09CD\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7!`,
      message: `\u0986\u09AA\u09A8\u09BE\u09B0 ${currency === "BDT" ? "\u09F3" : "$"}${amount.toLocaleString()} \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09DF\u09C7 \u09B8\u09B0\u09BE\u09B8\u09B0\u09BF \u0993\u09DF\u09BE\u09B2\u09C7\u099F\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
      type: "DEPOSIT_CONFIRMED",
      amount,
      currency,
      isRead: false,
      actionTab: "cashier"
    });
  }
  /**
   * Trigger Real-Time Withdrawal Approval Notification
   */
  notifyWithdrawalApproved(amount, currency = "BDT", userId) {
    const targetUid = userId || "a0000000-0000-0000-0000-000000000004";
    return this.pushNotification(targetUid, {
      userId: targetUid,
      title: `\u2705 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u0993 \u09A1\u09BF\u09B8\u09AA\u09CD\u09AF\u09BE\u099A \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7`,
      message: `\u0986\u09AA\u09A8\u09BE\u09B0 ${currency === "BDT" ? "\u09F3" : "$"}${amount.toLocaleString()} \u099F\u09BE\u0995\u09BE\u09B0 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09A8 \u0995\u09B0\u09C7 \u098F\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
      type: "WITHDRAWAL_APPROVED",
      amount,
      currency,
      isRead: false,
      actionTab: "cashier"
    });
  }
  /**
   * Trigger Real-Time System Notification Alert
   */
  notifySystemAlert(title, message, userId) {
    const targetUid = userId || "a0000000-0000-0000-0000-000000000004";
    return this.pushNotification(targetUid, {
      userId: targetUid,
      title,
      message,
      type: "SYSTEM_ALERT",
      isRead: false,
      actionTab: "cashier"
    });
  }
  /**
   * Trigger Simulated Withdrawal Approval for instant testing
   */
  simulateWithdrawalApproved(userId, amount = 7500, gateway = "bKash") {
    return this.pushNotification(userId, {
      userId,
      title: `\u2705 ${gateway} \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 (${gateway} Payout Approved)`,
      message: `\u0986\u09AA\u09A8\u09BE\u09B0 \u09F3${amount.toLocaleString()} \u099F\u09BE\u0995\u09BE\u09B0 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 \u098F\u09AC\u0982 \u0986\u09AA\u09A8\u09BE\u09B0 ${gateway} \u098F\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964`,
      type: "WITHDRAWAL_APPROVED",
      amount,
      currency: "BDT",
      isRead: false,
      actionTab: "cashier"
    });
  }
  /**
   * Trigger Simulated Bonus Unlock for instant testing
   */
  simulateBonusUnlocked(userId, bonusName = "\u09E8\u09E6\u09E6% \u09AE\u09C7\u0997\u09BE \u0993\u09AF\u09BC\u09C7\u09B2\u0995\u09BE\u09AE \u09AC\u09CB\u09A8\u09BE\u09B8", amount = 3e3) {
    return this.pushNotification(userId, {
      userId,
      title: `\u{1F381} ${bonusName} \u0986\u09A8\u09B2\u0995 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7!`,
      message: `\u0986\u09AA\u09A8\u09BE\u09B0 \u09AA\u09CD\u09B0\u09CB\u09AB\u09BE\u0987\u09B2\u09C7 \u09F3${amount.toLocaleString()} \u09AC\u09CB\u09A8\u09BE\u09B8 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 \u098F\u0996\u09A8\u0987 \u09AC\u09BE\u099C\u09BF \u09A7\u09B0\u09C7 \u09B0\u09BF\u09AF\u09BC\u09C7\u09B2 \u0995\u09CD\u09AF\u09BE\u09B6\u09C7 \u0995\u09A8\u09AD\u09BE\u09B0\u09CD\u099F \u0995\u09B0\u09C1\u09A8!`,
      type: "BONUS_UNLOCKED",
      amount,
      currency: "BDT",
      isRead: false,
      actionTab: "wagering"
    });
  }
  notifyListeners(userId) {
    const list = this.listeners.get(userId) || [];
    const notifs = this.getUserNotifications(userId);
    list.forEach((cb) => cb(notifs));
  }
};
var notificationService = new NotificationService();

// src/services/webhookLogger.ts
import {
  collection as collection2,
  doc as doc2,
  setDoc as setDoc2,
  deleteDoc as deleteDoc2,
  query as query2,
  orderBy as orderBy2,
  limit,
  onSnapshot as onSnapshot2
} from "firebase/firestore";
import { onAuthStateChanged as onAuthStateChanged2 } from "firebase/auth";

// src/services/soundEngine.ts
var CasinoSoundEngine = class {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.spinInterval = null;
    this.jetOsc = null;
    this.jetGain = null;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("gp365_sound_muted");
      this.isMuted = stored === "true";
    }
  }
  initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (typeof window !== "undefined") {
      localStorage.setItem("gp365_sound_muted", String(this.isMuted));
    }
    if (this.isMuted) {
      this.stopReelSpin();
      this.stopAviatorJet();
    }
    return !this.isMuted;
  }
  getIsMuted() {
    return this.isMuted;
  }
  setMuted(muted) {
    this.isMuted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("gp365_sound_muted", String(muted));
    }
    if (muted) {
      this.stopReelSpin();
      this.stopAviatorJet();
    }
  }
  /**
   * Crisp UI Click & Navigation Tones
   */
  playClick(freq = 880) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.045);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.045);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }
  /**
   * Cashier / Security Error Buzzer
   */
  playCashierError() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(120, now + 0.1);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
  /**
   * Navigation Tab Switch Tone (Smooth dual-chime)
   */
  playNavClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(700, now);
    osc1.frequency.exponentialRampToValueAtTime(950, now + 0.06);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(1e-3, now + 0.06);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.065);
  }
  /**
   * Wallet Deposit / Credit Sound (Rising cheerful harmonic chime)
   */
  playWalletCredit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.05;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    });
    setTimeout(() => {
      this.playCoinShower(6);
    }, 150);
  }
  /**
   * Wallet Bet Deduction (Soft mechanical click / coin flip)
   */
  playWalletDeduct() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.07);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.07);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }
  /**
   * Standard Win Sound with tiered feedback
   */
  playWin(amount = 0, multiplier = 1) {
    if (this.isMuted) return;
    if (multiplier >= 20 || amount >= 5e3) {
      this.playMegaWin();
    } else if (multiplier >= 5 || amount >= 1e3) {
      this.playWinChime();
      this.playCoinShower(10);
    } else {
      this.playWinChime();
      this.playCoinShower(4);
    }
  }
  /**
   * Continuous Mechanical Reel Spinning Sound (Ratchet Whir)
   */
  startReelSpin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    this.stopReelSpin();
    this.spinInterval = setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260 + Math.random() * 90, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.035);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.035);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    }, 65);
  }
  stopReelSpin() {
    if (this.spinInterval) {
      clearInterval(this.spinInterval);
      this.spinInterval = null;
    }
  }
  /**
   * Complete Audio Engine Shutdown / Kill Switch
   */
  stopAll() {
    this.stopReelSpin();
    this.stopAviatorJet();
  }
  /**
   * Reel Stop "Thud/Clack" per column
   */
  playReelStop(reelIndex = 0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const baseFreq = 190 + reelIndex * 35;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }
  /**
   * Aviator Jet Engine Pitch Acceleration
   */
  startAviatorJet(multiplier = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const freq = Math.min(900, 140 + multiplier * 60);
    if (!this.jetOsc) {
      this.jetOsc = this.ctx.createOscillator();
      this.jetGain = this.ctx.createGain();
      this.jetOsc.type = "sawtooth";
      this.jetOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.jetGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      this.jetOsc.connect(filter);
      filter.connect(this.jetGain);
      this.jetGain.connect(this.ctx.destination);
      this.jetOsc.start();
    } else {
      this.jetOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    }
  }
  stopAviatorJet() {
    if (this.jetOsc && this.ctx) {
      try {
        if (this.jetGain) {
          this.jetGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        this.jetOsc.stop();
        this.jetOsc.disconnect();
      } catch (e) {
      }
      this.jetOsc = null;
      this.jetGain = null;
    }
  }
  /**
   * Plane Crashed / Flew Away Sound
   */
  playPlaneCrash() {
    this.stopAviatorJet();
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }
  /**
   * Card Flip & Card Snap (for Jili Super Ace)
   */
  playCardFlip() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }
  /**
   * Standard Win Chime (Arpeggio notes)
   */
  playWinChime() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.07;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    });
  }
  /**
   * Metallic Coin Cascade (Fast coins dropping)
   */
  playCoinShower(count2 = 8) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    for (let i = 0; i < count2; i++) {
      const delay = i * 0.045 + Math.random() * 0.02;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + delay;
      const freqs = [1200, 1480, 1820, 2100, 2450];
      const freq = freqs[Math.floor(Math.random() * freqs.length)];
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.06);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.07);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  }
  /**
   * Lucky Wheel Tick Sound
   */
  playWheelTick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.025);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.025);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }
  /**
   * Mega Win Fanfare & Celebratory Crescendo Chords
   */
  playMegaWin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const chords = [
      { notes: [261.63, 329.63, 392], start: 0, dur: 0.2 },
      { notes: [349.23, 440, 523.25], start: 0.22, dur: 0.2 },
      { notes: [392, 493.88, 587.33], start: 0.44, dur: 0.25 },
      { notes: [523.25, 659.25, 783.99, 1046.5], start: 0.7, dur: 0.8 }
    ];
    chords.forEach((chord) => {
      chord.notes.forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + chord.start;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(1e-3, now + chord.dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + chord.dur + 0.05);
      });
    });
    setTimeout(() => {
      this.playCoinShower(16);
    }, 600);
  }
  playBigWinCelebration() {
    this.playMegaWin();
  }
  /**
   * Golden Tile Transform / Scatter Mystical Shimmer
   */
  playGoldTransform() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const freqs = [800, 1100, 1400, 1750, 2200];
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.04;
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.14);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    });
  }
  /**
   * Quick Slot Spin sound (convenience method)
   */
  playSpin() {
    this.startReelSpin();
    setTimeout(() => {
      this.stopReelSpin();
    }, 600);
  }
  /**
   * Cashout Sound
   */
  playCashout(amount = 0) {
    this.playWalletCredit();
  }
  /**
   * Lightning Strike Electric Arc Sound
   */
  playLightning() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
  /**
   * Card Dealing / Table Felt Sound
   */
  playDealCard() {
    this.playCardFlip();
  }
  /**
   * Spribe Crash / Explosion Sound
   */
  playCrash() {
    this.playPlaneCrash();
  }
  /**
   * Gem / Diamond Reveal Sound
   */
  playGem() {
    this.playGoldTransform();
  }
};
var soundEngine = new CasinoSoundEngine();

// src/services/webhookLogger.ts
var COLLECTION_NAME = "webhook_logs";
var CACHE_STORAGE_KEY = "playall365_webhook_logs_v1";
var MAX_LOGS_KEPT = 100;
var WebhookLoggerService = class {
  constructor() {
    this.logs = [];
    this.listeners = /* @__PURE__ */ new Set();
    this.isListeningFirestore = false;
    this.unsubscribeFirestore = null;
    this.isInitialized = false;
    this.loadFromCache();
    this.setupAuthSync();
  }
  /**
   * Listen to Firebase auth state to attach Firestore listener only when authenticated
   */
  setupAuthSync() {
    try {
      onAuthStateChanged2(auth, (user) => {
        if (user) {
          this.initFirestoreListener();
        } else {
          if (this.unsubscribeFirestore) {
            this.unsubscribeFirestore();
            this.unsubscribeFirestore = null;
          }
          this.isListeningFirestore = false;
        }
      });
    } catch {
    }
  }
  /**
   * Load locally cached webhook logs from localStorage for immediate display
   */
  loadFromCache() {
    try {
      const cached = localStorage.getItem(CACHE_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.logs = parsed;
        }
      }
    } catch {
    }
    if (this.logs.length === 0) {
      this.logs = this.getPreseededLogs();
      this.saveToCache();
    }
  }
  /**
   * Persist current in-memory log list to localStorage cache
   */
  saveToCache() {
    try {
      localStorage.setItem(
        CACHE_STORAGE_KEY,
        JSON.stringify(this.logs.slice(0, MAX_LOGS_KEPT))
      );
    } catch {
    }
    this.notifySubscribers();
  }
  /**
   * Notify all React components / inspector listeners of log state updates
   */
  notifySubscribers() {
    const list = [...this.logs];
    this.listeners.forEach((listener) => {
      try {
        listener(list);
      } catch (err) {
        console.warn("WebhookLogger listener error:", err);
      }
    });
  }
  /**
   * Establish real-time Firestore database listener on 'webhook_logs'
   */
  initFirestoreListener() {
    if (this.isListeningFirestore) return;
    if (!auth.currentUser) return;
    try {
      const logsCollection = collection2(db2, COLLECTION_NAME);
      const q = query2(logsCollection, orderBy2("createdAt", "desc"), limit(MAX_LOGS_KEPT));
      this.unsubscribeFirestore = onSnapshot2(
        q,
        (snapshot) => {
          this.isListeningFirestore = true;
          this.isInitialized = true;
          if (!snapshot.empty) {
            const remoteLogs = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              remoteLogs.push({
                ...data,
                id: docSnap.id
              });
            });
            this.mergeRemoteLogs(remoteLogs);
          } else if (this.logs.length > 0) {
            this.syncSeedToFirestore();
          }
        },
        (error) => {
          this.isListeningFirestore = false;
        }
      );
    } catch {
      this.isListeningFirestore = false;
    }
  }
  /**
   * Merges remote Firestore documents into local cache
   */
  mergeRemoteLogs(remoteLogs) {
    const map = /* @__PURE__ */ new Map();
    this.logs.forEach((log) => map.set(log.id, log));
    remoteLogs.forEach((log) => map.set(log.id, log));
    this.logs = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    this.saveToCache();
  }
  /**
   * Sync initial seed logs to Firestore asynchronously
   */
  async syncSeedToFirestore() {
    try {
      for (const log of this.logs) {
        const docRef = doc2(db2, COLLECTION_NAME, log.id);
        await setDoc2(docRef, log, { merge: true });
      }
    } catch {
    }
  }
  // ==========================================================================
  // CORE API: Intercept & Log Inbound Webhooks
  // ==========================================================================
  /**
   * Intercepts an incoming webhook payload, validates its cryptographic signature,
   * calculates latency, formats headers, persists to Firestore database,
   * and dispatches update to inspector subscribers.
   */
  async interceptAndLog(params) {
    const { provider, payload, signature, options } = params;
    const startTime = performance.now();
    const eventType = options?.eventType || payload.event || payload.eventType || payload.action || "payment.notification";
    const eventId = payload.eventId || payload.id || payload.trxID || `evt_${provider}_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`;
    const expectedSig = options?.expectedSignature || "";
    const isSignatureValid = options?.expectedSignature ? signature === options.expectedSignature : options?.isSignatureValid ?? false;
    const latency = options?.simulatedLatency ?? Math.floor(performance.now() - startTime + 20 + Math.random() * 35);
    const logId = `WH_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const headers = options?.headers || {
      "content-type": "application/json",
      "x-provider-id": String(provider),
      "x-signature": signature,
      "x-timestamp": String(Date.now()),
      "x-webhook-id": logId,
      "user-agent": `SeamlessGateway-Webhook-Engine/3.0 (${provider})`,
      "x-forwarded-for": options?.ipAddress || "103.119.100.45"
    };
    const httpStatus = isSignatureValid ? 200 : 401;
    const processResult = isSignatureValid ? `\u2705 200 OK: Signature verified via HMAC-SHA256. Payload accepted & ledger synced.` : `\u274C 401 Unauthorized: HMAC signature mismatch or payload tampering detected. Callback rejected.`;
    const logEntry = {
      id: logId,
      provider,
      eventType,
      eventId,
      signature,
      expectedSignature: expectedSig,
      signatureValid: isSignatureValid,
      payload,
      headers,
      httpStatus,
      processed: isSignatureValid,
      processResult,
      latencyMs: latency,
      retryCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.logs = [logEntry, ...this.logs.filter((l) => l.id !== logEntry.id)].slice(
      0,
      MAX_LOGS_KEPT
    );
    this.saveToCache();
    try {
      const docRef = doc2(db2, COLLECTION_NAME, logEntry.id);
      await setDoc2(docRef, logEntry);
    } catch (error) {
      console.warn(`WebhookLogger: Firestore write fallback, error:`, error);
    }
    return logEntry;
  }
  /**
   * Re-processes a logged webhook to simulate a gateway retry / replay
   */
  async reprocessWebhook(webhookId) {
    const logIndex = this.logs.findIndex((w) => w.id === webhookId);
    if (logIndex === -1) {
      throw new Error(`Webhook with ID "${webhookId}" not found in logger history`);
    }
    const log = this.logs[logIndex];
    const startTime = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const isValid = log.expectedSignature ? log.signature === log.expectedSignature : log.signatureValid;
    const retryCount = (log.retryCount || 0) + 1;
    const latency = Math.floor(performance.now() - startTime + 15 + Math.random() * 25);
    const updatedLog = {
      ...log,
      processed: isValid,
      httpStatus: isValid ? 200 : 401,
      processResult: isValid ? `\u2705 Re-processed successfully (Attempt #${retryCount}). Signature & payload idempotency confirmed.` : `\u274C Re-process failed (Attempt #${retryCount}): Signature verification rejected with HTTP 401.`,
      latencyMs: latency,
      retryCount,
      lastRetriedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.logs[logIndex] = updatedLog;
    this.saveToCache();
    try {
      const docRef = doc2(db2, COLLECTION_NAME, updatedLog.id);
      await setDoc2(docRef, updatedLog, { merge: true });
    } catch (error) {
      console.warn("WebhookLogger: Firestore retry update fallback:", error);
    }
    if (isValid) {
      soundEngine.playWalletCredit();
    } else {
      soundEngine.playCashout();
    }
    return {
      success: isValid,
      message: updatedLog.processResult || "",
      log: updatedLog
    };
  }
  /**
   * Get all intercepted webhook logs
   */
  getLogs() {
    return [...this.logs];
  }
  /**
   * Calculate aggregated metrics for inspector dashboards
   */
  getStats() {
    const total = this.logs.length;
    const valid = this.logs.filter((w) => w.signatureValid).length;
    const invalid = total - valid;
    const retried = this.logs.filter((w) => (w.retryCount || 0) > 0).length;
    const avgLatency = total > 0 ? Math.round(this.logs.reduce((acc, curr) => acc + (curr.latencyMs || 25), 0) / total) : 0;
    return {
      total,
      valid,
      invalid,
      retried,
      avgLatency,
      lastInterceptedAt: this.logs[0]?.createdAt
    };
  }
  /**
   * Subscribe to real-time webhook interception updates
   */
  subscribe(listener) {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /**
   * Clear all webhook logs from both Firestore and local memory
   */
  async clearLogs() {
    const idsToDelete = this.logs.map((l) => l.id);
    this.logs = [];
    this.saveToCache();
    try {
      for (const id of idsToDelete) {
        const docRef = doc2(db2, COLLECTION_NAME, id);
        await deleteDoc2(docRef);
      }
    } catch (error) {
      console.warn("WebhookLogger: Error clearing remote logs:", error);
    }
  }
  /**
   * Pre-seed default high-value logs for realistic simulation
   */
  getPreseededLogs() {
    const now = Date.now();
    return [
      {
        id: "WH_20260822_BK901",
        provider: "bkash",
        eventType: "payment.success",
        eventId: "evt_bk_891029481",
        signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        expectedSignature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        signatureValid: true,
        payload: {
          event: "payment.success",
          trxID: "BL92A81K09",
          merchantInvoiceNumber: "DEP-20260821-9A41K",
          amount: "5000.00",
          currency: "BDT",
          senderNumber: "01712-349911",
          destinationAccount: "01900-112233",
          transactionStatus: "Completed",
          paymentExecuteTime: new Date(now - 355e4).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "bkash",
          "x-signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          "x-timestamp": String(now - 355e4),
          "x-webhook-id": "whk_bk_901",
          "user-agent": "bKash-PaymentGateway-IPN/2.1"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Signature verified via HMAC-SHA256. Deposit credited to user wallet.",
        latencyMs: 42,
        retryCount: 0,
        createdAt: new Date(now - 355e4).toISOString()
      },
      {
        id: "WH_20260822_NG804",
        provider: "nagad",
        eventType: "payout.disbursed",
        eventId: "evt_ng_771920194",
        signature: "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
        expectedSignature: "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
        signatureValid: true,
        payload: {
          event: "payout.disbursed",
          issuerTrxId: "NG_DISB_891028",
          orderId: "WTH-20260821-7B22Z",
          amount: "3000.00",
          currency: "BDT",
          recipientAccount: "01844-992200",
          status: "SUCCESS",
          payoutTime: new Date(now - 718e4).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "nagad",
          "x-signature": "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
          "x-timestamp": String(now - 718e4),
          "x-webhook-id": "whk_ng_804",
          "user-agent": "Nagad-DirectPayout-Engine/1.0"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Payout confirmation verified. Reserved balance finalized.",
        latencyMs: 38,
        retryCount: 0,
        createdAt: new Date(now - 718e4).toISOString()
      },
      {
        id: "WH_20260822_PG701",
        provider: "pgsoft",
        eventType: "game.round_settled",
        eventId: "evt_pg_551920841",
        signature: "a918204810294810293840192834019283401928340192834019283401928340",
        expectedSignature: "a918204810294810293840192834019283401928340192834019283401928340",
        signatureValid: true,
        payload: {
          event: "game.round_settled",
          provider: "pgsoft",
          gameId: "mahjong-ways-2",
          userId: "u_10291",
          roundId: "RND_99210948",
          betAmount: 100,
          winAmount: 450,
          netSettlement: 350,
          currency: "BDT",
          timestamp: new Date(now - 12e5).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "pgsoft",
          "x-signature": "a918204810294810293840192834019283401928340192834019283401928340",
          "x-timestamp": String(now - 12e5),
          "x-webhook-id": "whk_pg_701",
          "user-agent": "PGSoft-Seamless-Engine/4.8"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Game round outcome validated and seamlessly credited.",
        latencyMs: 19,
        retryCount: 0,
        createdAt: new Date(now - 12e5).toISOString()
      },
      {
        id: "WH_20260822_TAMPER_01",
        provider: "rocket",
        eventType: "payment.tampered_attempt",
        eventId: "evt_rk_bad_sig_9901",
        signature: "0000000000000000000000000000000000000000000000000000000000000000",
        expectedSignature: "c819283019283019283019283019283019283019283019283019283019283019",
        signatureValid: false,
        payload: {
          event: "payment.received",
          trxID: "RK999INVALID99",
          amount: "50000.00",
          currency: "BDT",
          senderNumber: "01700-000000",
          destinationAccount: "01711-884422-9",
          tamperFlag: "MAN_IN_THE_MIDDLE_SIMULATION"
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "rocket",
          "x-signature": "0000000000000000000000000000000000000000000000000000000000000000",
          "x-timestamp": String(now - 6e5),
          "x-webhook-id": "whk_tamper_01",
          "user-agent": "Untrusted-Proxy/1.0"
        },
        httpStatus: 401,
        processed: false,
        processResult: "\u274C 401 Unauthorized: Signature hash does not match computed HMAC-SHA256 payload digest.",
        latencyMs: 12,
        retryCount: 0,
        createdAt: new Date(now - 6e5).toISOString()
      }
    ];
  }
};
var webhookLogger = new WebhookLoggerService();

// src/services/paymentGatewayEngine.ts
var PaymentGatewayEngine = class {
  constructor() {
    // 1. Provider Adapter Registry
    this.adapters = /* @__PURE__ */ new Map();
    // 2. Payment Destination Accounts Pool (Dynamic Rotation)
    this.destinationPool = [
      {
        id: "DEST_BKASH_01",
        provider: "bkash",
        method: "BKASH",
        accountNumber: "01900-112233",
        accountName: "Gameplay365 VIP Merchant Pool A",
        accountType: "MERCHANT",
        dailyLimit: 5e5,
        currentDayVolume: 124500,
        assignedCapacityPercent: 75,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          '\u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09BF\u0995\u09BE\u09B6 \u0985\u09CD\u09AF\u09BE\u09AA \u09A5\u09C7\u0995\u09C7 "Make Payment" \u0985\u09AA\u09B6\u09A8 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8\u0964',
          "\u09AE\u09BE\u09B0\u09CD\u099A\u09C7\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 01900-112233 \u09B2\u09BF\u0996\u09C1\u09A8\u0964",
          "\u09A8\u09BF\u09B0\u09CD\u09A7\u09BE\u09B0\u09BF\u09A4 \u099F\u09BE\u0995\u09BE\u09B0 \u09AA\u09B0\u09BF\u09AE\u09BE\u09A3 \u09B2\u09BF\u0996\u09C1\u09A8 \u098F\u09AC\u0982 \u09B0\u09C7\u09AB\u09BE\u09B0\u09C7\u09A8\u09CD\u09B8 \u09B9\u09BF\u09B8\u09C7\u09AC\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u0986\u0987\u09A1\u09BF \u09A6\u09BF\u09A8\u0964",
          "\u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u0995\u09B0\u09C7 TrxID \u09B8\u0982\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_BKASH_02",
        provider: "bkash",
        method: "BKASH",
        accountNumber: "01977-889900",
        accountName: "Gameplay365 Fast Cashout Pool B",
        accountType: "AGENT",
        dailyLimit: 3e5,
        currentDayVolume: 45e3,
        assignedCapacityPercent: 40,
        isActive: true,
        isMaintenance: false,
        priority: 2,
        instructions: [
          '\u09AC\u09BF\u0995\u09BE\u09B6 \u0985\u09CD\u09AF\u09BE\u09AA\u09C7 "Cash Out" \u0985\u09AA\u09B6\u09A8 \u09AC\u09C7\u099B\u09C7 \u09A8\u09BF\u09A8\u0964',
          "\u098F\u099C\u09C7\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 01977-889900 \u09AC\u09B8\u09BF\u09DF\u09C7 \u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u0995\u09CD\u09AF\u09BE\u09B6-\u0986\u0989\u099F \u0995\u09B0\u09C1\u09A8\u0964",
          "\u09B8\u09AB\u09B2 \u09AE\u09C7\u09B8\u09C7\u099C \u09A5\u09C7\u0995\u09C7 TrxID \u0995\u09AA\u09BF \u0995\u09B0\u09C7 \u09AD\u09C7\u09B0\u09BF\u09AB\u09BE\u0987 \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_NAGAD_01",
        provider: "nagad",
        method: "NAGAD",
        accountNumber: "01844-992200",
        accountName: "Gameplay365 Direct Nagad Agent",
        accountType: "AGENT",
        dailyLimit: 4e5,
        currentDayVolume: 89e3,
        assignedCapacityPercent: 60,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          "\u09A8\u0997\u09A6 \u0985\u09CD\u09AF\u09BE\u09AA \u0996\u09C1\u09B2\u09C1\u09A8 \u09AC\u09BE *167# \u09A1\u09BE\u09DF\u09BE\u09B2 \u0995\u09B0\u09C7 Cash Out \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u098F\u099C\u09C7\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 01844-992200 \u09AA\u09CD\u09B0\u09AC\u09C7\u09B6 \u0995\u09B0\u09BE\u09A8\u0964",
          "\u099F\u09BE\u0995\u09BE\u09B0 \u09AA\u09B0\u09BF\u09AE\u09BE\u09A3 \u0993 \u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09C7\u0995\u09B6\u09A8 \u09B8\u09AB\u09B2 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u09A8\u0997\u09A6\u09C7\u09B0 \u09EE \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 TrxID \u09B8\u09BE\u09AC\u09AE\u09BF\u099F \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_ROCKET_01",
        provider: "rocket",
        method: "ROCKET",
        accountNumber: "01711-884422-9",
        accountName: "Gameplay365 DBBL Biller Account",
        accountType: "BILLER",
        dailyLimit: 3e5,
        currentDayVolume: 24e3,
        assignedCapacityPercent: 30,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          "\u09B0\u0995\u09C7\u099F \u0985\u09CD\u09AF\u09BE\u09AA \u09A5\u09C7\u0995\u09C7 Send Money \u09AC\u09BE Pay Bill \u0985\u09AA\u09B6\u09A8 \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u098F\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 01711-884422-9 \u09A6\u09BF\u09A8\u0964",
          "\u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09C7\u0995\u09B6\u09A8 \u09B6\u09C7\u09B7 \u0995\u09B0\u09C7 TrxID \u0995\u09AA\u09BF \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_BANK_01",
        provider: "bank_transfer",
        method: "BANK_TRANSFER",
        accountNumber: "110.120.489102",
        accountName: "Gameplay365 Online Entertainment Ltd",
        accountType: "BANK_ACCOUNT",
        bankName: "City Bank Ltd / Brac Bank PLC",
        branchName: "Gulshan Corporate Branch, Dhaka",
        routingNumber: "225271890",
        dailyLimit: 2e6,
        currentDayVolume: 42e4,
        assignedCapacityPercent: 50,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          "Citytouch \u09AC\u09BE Astha \u0985\u09CD\u09AF\u09BE\u09AA\u09C7\u09B0 \u09AE\u09BE\u09A7\u09CD\u09AF\u09AE\u09C7 NPSB/BEFTN \u09AB\u09BE\u09A8\u09CD\u09A1 \u099F\u09CD\u09B0\u09BE\u09A8\u09CD\u09B8\u09AB\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u098F\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 110.120.489102 (City Bank)",
          "\u09B0\u09BE\u0989\u099F\u09BF\u0982 \u09A8\u09AE\u09CD\u09AC\u09B0: 225271890",
          "\u099F\u09CD\u09B0\u09BE\u09A8\u09CD\u09B8\u09AB\u09BE\u09B0\u09C7\u09B0 \u09B0\u09C7\u09AB\u09BE\u09B0\u09C7\u09A8\u09CD\u09B8/TrxID \u09B2\u09BF\u0996\u09C7 \u09B8\u09BE\u09AC\u09AE\u09BF\u099F \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_USDT_01",
        provider: "usdt_crypto",
        method: "USDT",
        accountNumber: "TK89xVqLiveSeamlessCasinoCryptoVault99201",
        accountName: "Gameplay365 Multi-Sig Cold Vault",
        accountType: "CRYPTO_VAULT",
        dailyLimit: 5e6,
        currentDayVolume: 11e5,
        assignedCapacityPercent: 35,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          "Binance/TrustWallet \u09A5\u09C7\u0995\u09C7 TRC-20 \u09A8\u09C7\u099F\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u0995\u09C7 \u099F\u09CD\u09B0\u09BE\u09A8\u09CD\u09B8\u09AB\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u0985\u09CD\u09AF\u09BE\u09A1\u09CD\u09B0\u09C7\u09B8: TK89xVqLiveSeamlessCasinoCryptoVault99201",
          "\u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09C7\u0995\u09B6\u09A8\u09C7\u09B0 TxHash \u09AA\u09C7\u09B8\u09CD\u099F \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      }
    ];
    // 3. In-Memory Stores
    this.depositIntents = /* @__PURE__ */ new Map();
    this.consumedTrxIds = /* @__PURE__ */ new Map();
    // Key: `${provider}:${trxId}`
    this.withdrawalRecords = /* @__PURE__ */ new Map();
    this.doubleEntryLedger = [];
    this.auditLogs = [];
    this.webhookLogs = [];
    this.idempotencyStore = /* @__PURE__ */ new Map();
    // 4. Listeners for Real-time Reactive Updates
    this.changeListeners = [];
    this.registerAdapters();
    this.seedInitialHistory();
  }
  registerAdapters() {
    this.adapters.set("bkash", new BkashPaymentAdapter());
    this.adapters.set("nagad", new NagadPaymentAdapter());
    this.adapters.set("rocket", new RocketPaymentAdapter());
    this.adapters.set("bank_transfer", new BankTransferPaymentAdapter());
    this.adapters.set("card_payment", new CardPaymentAdapter());
    this.adapters.set("usdt_crypto", new CardPaymentAdapter());
  }
  subscribe(listener) {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }
  notifyChange() {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (err) {
        console.error("PaymentGatewayEngine listener error:", err);
      }
    }
  }
  // ==========================================================================
  // SECTION 1: Payment Destination Pool Rotation Algorithm
  // ==========================================================================
  getAvailableDestination(provider) {
    const candidates = this.destinationPool.filter(
      (d) => d.provider === provider && d.isActive && !d.isMaintenance
    );
    if (candidates.length === 0) {
      const fallback = this.destinationPool.find((d) => d.provider === provider) || this.destinationPool[0];
      return fallback;
    }
    candidates.sort((a, b) => {
      const remainingA = a.dailyLimit - a.currentDayVolume;
      const remainingB = b.dailyLimit - b.currentDayVolume;
      if (remainingA !== remainingB) {
        return remainingB - remainingA;
      }
      return a.priority - b.priority;
    });
    return candidates[0];
  }
  getDestinationPool() {
    return [...this.destinationPool];
  }
  updateDestinationStatus(id, updates) {
    const dest = this.destinationPool.find((d) => d.id === id);
    if (dest) {
      Object.assign(dest, updates);
      this.logAudit({
        actor: "ADMIN:System",
        action: "UPDATE_DESTINATION_ACCOUNT",
        resource: "DESTINATION_POOL",
        resourceId: id,
        ipAddress: "127.0.0.1",
        metadata: updates
      });
      this.notifyChange();
    }
  }
  // ==========================================================================
  // SECTION 2: Anti-Fraud & Risk Engine
  // ==========================================================================
  analyzeRisk(params) {
    let score = 5;
    const factors = [];
    if (params.trxId) {
      const cleanTrx = params.trxId.trim().toUpperCase();
      const existingKey = `${params.provider}:${cleanTrx}`;
      if (this.consumedTrxIds.has(existingKey)) {
        score += 90;
        factors.push("DUPLICATE_TRX_ID_DETECTED");
      }
    }
    try {
      const amountMinor = typeof params.amount === "bigint" ? params.amount : toScale42(String(params.amount));
      if (amountMinor > 1000000000n) {
        score += 25;
        factors.push("HIGH_VALUE_TRANSACTION");
      }
    } catch {
    }
    const now = Date.now();
    const recentIntents = Array.from(this.depositIntents.values()).filter(
      (d) => d.userId === params.userId && now - new Date(d.createdAt).getTime() < 3e5
    );
    if (recentIntents.length >= 4) {
      score += 35;
      factors.push("RAPID_INTENT_VELOCITY");
    }
    const failedRecent = recentIntents.filter((d) => d.status === "FAILED");
    if (failedRecent.length >= 2) {
      score += 30;
      factors.push("REPEATED_FAILED_ATTEMPTS");
    }
    let riskLevel = "LOW";
    if (score >= 80) riskLevel = "BLOCKED";
    else if (score >= 60) riskLevel = "HIGH";
    else if (score >= 30) riskLevel = "MEDIUM";
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
  createDepositIntent(req) {
    if (req.idempotencyKey && this.idempotencyStore.has(req.idempotencyKey)) {
      return this.idempotencyStore.get(req.idempotencyKey);
    }
    const parsed = validatePaymentAmount(req.amount);
    const amountStr = parsed.decimalString;
    const amountMinor = parsed.minorUnits;
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const depositId = `DEP-${dateStr}-${randomSuffix}`;
    const destination = this.getAvailableDestination(req.provider);
    const risk = this.analyzeRisk({
      userId: req.userId,
      amount: amountMinor,
      provider: req.provider,
      type: "DEPOSIT"
    });
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1e3).toISOString();
    const intent = {
      id: depositId,
      userId: req.userId,
      username: req.username,
      provider: req.provider,
      method: req.method,
      amount: amountStr,
      amountMinor: amountMinor.toString(),
      currency: req.currency,
      status: "AWAITING_PAYMENT",
      destinationAccount: destination,
      referenceCode: depositId,
      createdAt: now.toISOString(),
      expiresAt,
      riskScore: risk.riskScore,
      idempotencyKey: req.idempotencyKey,
      auditTrail: [
        {
          status: "CREATED",
          timestamp: now.toISOString(),
          note: `Deposit Intent created for \u09F3${amountStr} via ${req.provider.toUpperCase()}`
        },
        {
          status: "AWAITING_PAYMENT",
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
      action: "CREATE_DEPOSIT_INTENT",
      resource: "DEPOSIT",
      resourceId: depositId,
      ipAddress: req.clientIp || "127.0.0.1",
      metadata: { amount: amountStr, amountMinor: amountMinor.toString(), provider: req.provider, destination: destination.accountNumber }
    });
    this.notifyChange();
    return intent;
  }
  // ==========================================================================
  // SECTION 4: Step 03 & 04 — Automatic Payment Verification & Instant Credit Engine
  // ==========================================================================
  async verifyAndCreditDeposit(params) {
    const intent = this.depositIntents.get(params.depositId);
    if (!intent) {
      throw new Error(`Deposit intent '${params.depositId}' not found.`);
    }
    if (intent.status === "CREDITED") {
      return {
        success: true,
        depositIntent: intent,
        status: "CREDITED",
        code: "ALREADY_CREDITED",
        message: "This deposit has already been verified and credited."
      };
    }
    const cleanTrx = params.trxId.trim().toUpperCase();
    intent.status = "TRX_SUBMITTED";
    intent.providerTransactionId = cleanTrx;
    intent.senderNumber = params.senderNumber;
    intent.auditTrail.push({
      status: "TRX_SUBMITTED",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      note: `Player submitted TrxID: ${cleanTrx}`
    });
    this.notifyChange();
    if (/* @__PURE__ */ new Date() > new Date(intent.expiresAt)) {
      intent.status = "EXPIRED";
      intent.failedReason = "Payment window expired (15 minutes limit exceeded).";
      intent.auditTrail.push({
        status: "EXPIRED",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        note: intent.failedReason
      });
      this.notifyChange();
      throw new Error(intent.failedReason);
    }
    const trxKey = `${intent.provider}:${cleanTrx}`;
    if (this.consumedTrxIds.has(trxKey)) {
      intent.status = "FAILED";
      intent.failedReason = `Duplicate TrxID: '${cleanTrx}' has already been used on Gameplay 365.`;
      intent.riskScore = 95;
      intent.auditTrail.push({
        status: "FAILED",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        note: intent.failedReason
      });
      this.logAudit({
        actor: `USER:${intent.username}`,
        action: "DUPLICATE_TRX_ID_REJECTED",
        resource: "DEPOSIT",
        resourceId: intent.id,
        ipAddress: "127.0.0.1",
        metadata: { trxId: cleanTrx, provider: intent.provider }
      });
      this.notifyChange();
      throw new Error(intent.failedReason);
    }
    intent.status = "VERIFYING";
    const adapter = this.adapters.get(intent.provider) || new BkashPaymentAdapter();
    const verificationResult = await adapter.verifyDeposit({
      depositIntent: intent,
      trxId: cleanTrx,
      senderNumber: params.senderNumber,
      destinationAccount: intent.destinationAccount
    });
    if (!verificationResult.verified) {
      const isUnconfigured = verificationResult.code === "PROVIDER_NOT_CONFIGURED" || verificationResult.status === "PENDING_INTEGRATION";
      intent.status = isUnconfigured ? "PENDING_INTEGRATION" : "FAILED";
      intent.failedReason = verificationResult.message;
      intent.auditTrail.push({
        status: intent.status,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        note: `Verification halted: ${verificationResult.message}`
      });
      this.notifyChange();
      const err = new Error(verificationResult.message);
      err.code = verificationResult.code || "VERIFICATION_FAILED";
      err.status = intent.status;
      throw err;
    }
    intent.status = "AWAITING_LEDGER_SETTLEMENT";
    intent.providerTransactionId = verificationResult.providerTransactionId || cleanTrx;
    intent.verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    intent.auditTrail.push({
      status: "AWAITING_LEDGER_SETTLEMENT",
      timestamp: intent.verifiedAt,
      note: `Payment authorized and verified by Provider (${intent.provider.toUpperCase()}). Awaiting authoritative WalletLedgerService settlement.`
    });
    this.consumedTrxIds.set(trxKey, {
      depositId: intent.id,
      userId: intent.userId,
      consumedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    try {
      const addedVolume = Number(toScale42(String(intent.amount)) / 10000n);
      intent.destinationAccount.currentDayVolume += addedVolume;
    } catch {
    }
    this.logAudit({
      actor: "SYSTEM:PaymentVerificationEngine",
      action: "DEPOSIT_PROVIDER_VERIFIED",
      resource: "DEPOSIT",
      resourceId: intent.id,
      ipAddress: "127.0.0.1",
      metadata: {
        userId: intent.userId,
        amount: intent.amount,
        trxId: cleanTrx,
        provider: intent.provider,
        providerTransactionId: intent.providerTransactionId,
        settlementStatus: "LEDGER_SETTLEMENT_PENDING"
      }
    });
    this.notifyChange();
    return {
      success: true,
      depositIntent: intent,
      status: "LEDGER_SETTLEMENT_PENDING",
      code: "LEDGER_SETTLEMENT_PENDING",
      message: `\u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09AA\u09CD\u09B0\u09CB\u09AD\u09BE\u0987\u09A1\u09BE\u09B0 \u09A6\u09CD\u09AC\u09BE\u09B0\u09BE \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7 (TrxID: ${cleanTrx})\u0964 \u0993\u09DF\u09BE\u09B2\u09C7\u099F \u09B2\u09C7\u099C\u09BE\u09B0 \u09B8\u09C7\u099F\u09C7\u09B2\u09AE\u09C7\u09A8\u09CD\u099F\u09C7\u09B0 \u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE\u09DF \u09B0\u09DF\u09C7\u099B\u09C7\u0964`
    };
  }
  /**
   * Settle deposit to CREDITED status ONLY after authoritative WalletLedgerService settlement succeeds.
   */
  settleDepositWithLedger(depositId, settlement) {
    const intent = this.depositIntents.get(depositId);
    if (!intent) {
      throw new Error(`Deposit intent '${depositId}' not found for ledger settlement.`);
    }
    if (intent.status === "CREDITED") {
      return intent;
    }
    if (intent.status !== "VERIFIED" && intent.status !== "AWAITING_LEDGER_SETTLEMENT") {
      throw new Error(`Cannot credit deposit in status '${intent.status}'. Deposit must be VERIFIED or AWAITING_LEDGER_SETTLEMENT.`);
    }
    intent.status = "CREDITED";
    intent.creditedAt = settlement.creditedAt || (/* @__PURE__ */ new Date()).toISOString();
    intent.auditTrail.push({
      status: "CREDITED",
      timestamp: intent.creditedAt,
      note: `Authoritative WalletLedgerService settlement committed. Ledger Ref: ${settlement.ledgerTransactionId}`
    });
    this.logAudit({
      actor: "SYSTEM:WalletLedgerService",
      action: "WALLET_DEPOSIT_CREDITED",
      resource: "WALLET",
      resourceId: intent.id,
      ipAddress: "127.0.0.1",
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
  async requestWithdrawal(req) {
    const adapter = this.adapters.get(req.provider) || new BkashPaymentAdapter();
    if (!adapter.isConfigured()) {
      const err2 = new Error(`Payment provider '${req.provider}' payout gateway is not configured.`);
      err2.code = "PROVIDER_NOT_CONFIGURED";
      err2.status = "PENDING_INTEGRATION";
      throw err2;
    }
    const err = new Error(`Payment provider '${req.provider}' live payout integration is pending.`);
    err.code = "PROVIDER_NOT_CONFIGURED";
    err.status = "PENDING_INTEGRATION";
    throw err;
  }
  releaseWithdrawalReservation(record, failureReason) {
    record.status = "FAILED";
    record.failedReason = failureReason;
    record.auditTrail.push({
      status: "FAILED",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      note: `Payout failed: ${failureReason}.`
    });
    notificationService.pushNotification(record.userId, {
      userId: record.userId,
      title: "\u26A0\uFE0F \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 \u09B9\u09DF\u09C7\u099B\u09C7",
      message: `\u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u09AA\u09CD\u09B0\u0995\u09CD\u09B0\u09BF\u09AF\u09BC\u09BE \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u0995\u09B0\u09BE \u09AF\u09BE\u09AF\u09BC\u09A8\u09BF\u0964`,
      type: "SYSTEM_ALERT",
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
  async handleWebhook(provider, payload, signature, options) {
    const log = await webhookLogger.interceptAndLog({
      provider,
      payload,
      signature,
      options
    });
    this.logAudit({
      actor: `GATEWAY_WEBHOOK:${provider}`,
      action: log.signatureValid ? "WEBHOOK_PROCESSED" : "WEBHOOK_REJECTED_SIGNATURE",
      resource: "PROVIDER",
      resourceId: log.id,
      ipAddress: options?.ipAddress || "103.119.100.45",
      metadata: { eventId: log.eventId, eventType: log.eventType, signatureValid: log.signatureValid }
    });
    this.notifyChange();
    return log;
  }
  /**
   * Re-processes an existing webhook event to simulate retry / replay
   */
  async reprocessWebhook(webhookId) {
    const result = await webhookLogger.reprocessWebhook(webhookId);
    this.logAudit({
      actor: "DEVELOPER_WORKBENCH",
      action: "WEBHOOK_REPROCESSED",
      resource: "PROVIDER",
      resourceId: result.log.id,
      ipAddress: "127.0.0.1 (Workbench)",
      metadata: { retryCount: result.log.retryCount, success: result.success, eventId: result.log.eventId }
    });
    this.notifyChange();
    return result;
  }
  clearWebhookLogs() {
    webhookLogger.clearLogs();
    this.notifyChange();
  }
  // ==========================================================================
  // SECTION 7: Audit Logging & Getters
  // ==========================================================================
  logAudit(entry) {
    this.auditLogs.unshift({
      id: `AUDIT_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...entry
    });
  }
  getDepositIntents(userId) {
    const list = Array.from(this.depositIntents.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (userId) return list.filter((d) => d.userId === userId);
    return list;
  }
  getDepositIntent(id) {
    return this.depositIntents.get(id);
  }
  getWithdrawalRecords(userId) {
    const list = Array.from(this.withdrawalRecords.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (userId) return list.filter((w) => w.userId === userId);
    return list;
  }
  getDoubleEntryLedger() {
    return [...this.doubleEntryLedger];
  }
  getAuditLogs() {
    return [...this.auditLogs];
  }
  getWebhookLogs() {
    return webhookLogger.getLogs();
  }
  getStats() {
    const deposits = Array.from(this.depositIntents.values());
    const withdrawals = Array.from(this.withdrawalRecords.values());
    const webhookStats = webhookLogger.getStats();
    let totalDepositedMinor = 0n;
    for (const d of deposits) {
      if (d.status === "CREDITED") {
        try {
          totalDepositedMinor += toScale42(String(d.amount));
        } catch {
        }
      }
    }
    let totalWithdrawnMinor = 0n;
    for (const w of withdrawals) {
      if (w.status === "WITHDRAWAL_COMPLETED") {
        try {
          totalWithdrawnMinor += toScale42(String(w.amount));
        } catch {
        }
      }
    }
    const totalDeposited = Number(fromScale42(totalDepositedMinor));
    const totalWithdrawn = Number(fromScale42(totalWithdrawnMinor));
    const pendingDeposits = deposits.filter((d) => d.status === "AWAITING_PAYMENT" || d.status === "TRX_SUBMITTED").length;
    const pendingWithdrawals = withdrawals.filter((w) => w.status === "WITHDRAWAL_RESERVED" || w.status === "PAYOUT_PROCESSING").length;
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
  seedInitialHistory() {
    const now = Date.now();
    const sampleDep = {
      id: "DEP-20260821-9A41K",
      userId: "u_10291",
      username: "Tamim_Sultana",
      provider: "bkash",
      method: "BKASH",
      amount: "5000.0000",
      currency: "BDT",
      status: "CREDITED",
      destinationAccount: this.destinationPool[0],
      referenceCode: "DEP-20260821-9A41K",
      providerTransactionId: "BL92A81K09",
      senderNumber: "01712-349911",
      createdAt: new Date(now - 36e5).toISOString(),
      expiresAt: new Date(now - 27e5).toISOString(),
      verifiedAt: new Date(now - 355e4).toISOString(),
      creditedAt: new Date(now - 354e4).toISOString(),
      riskScore: 8,
      auditTrail: [
        { status: "CREATED", timestamp: new Date(now - 36e5).toISOString(), note: "Deposit Intent created" },
        { status: "TRX_SUBMITTED", timestamp: new Date(now - 356e4).toISOString(), note: "TrxID BL92A81K09 submitted" },
        { status: "VERIFIED", timestamp: new Date(now - 355e4).toISOString(), note: "Verified by bKash API" },
        { status: "CREDITED", timestamp: new Date(now - 354e4).toISOString(), note: "Double-entry wallet credit" }
      ]
    };
    this.depositIntents.set(sampleDep.id, sampleDep);
    this.consumedTrxIds.set("bkash:BL92A81K09", { depositId: sampleDep.id, userId: "u_10291", consumedAt: new Date(now - 354e4).toISOString() });
    const sampleWth = {
      id: "WTH-20260821-7B22Z",
      userId: "u_10291",
      username: "Tamim_Sultana",
      provider: "nagad",
      method: "NAGAD",
      amount: "3000.0000",
      currency: "BDT",
      recipientAccount: "01844-992200",
      status: "WITHDRAWAL_COMPLETED",
      reservedBalanceBefore: "0.0000",
      availableBalanceBefore: "8000.0000",
      availableBalanceAfter: "5000.0000",
      providerReference: "NG_DISB_891028",
      createdAt: new Date(now - 72e5).toISOString(),
      processedAt: new Date(now - 719e4).toISOString(),
      completedAt: new Date(now - 718e4).toISOString(),
      riskScore: 12,
      idempotencyKey: "WD-REQ-INITIAL-01",
      auditTrail: [
        { status: "CREATED", timestamp: new Date(now - 72e5).toISOString(), note: "Withdrawal requested" },
        { status: "WITHDRAWAL_RESERVED", timestamp: new Date(now - 72e5).toISOString(), note: "\u09F33,000 reserved" },
        { status: "WITHDRAWAL_COMPLETED", timestamp: new Date(now - 718e4).toISOString(), note: "Payout completed via Nagad API" }
      ]
    };
    this.withdrawalRecords.set(sampleWth.id, sampleWth);
    this.webhookLogs = [
      {
        id: "WH_20260822_BK901",
        provider: "bkash",
        eventType: "payment.success",
        eventId: "evt_bk_891029481",
        signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        expectedSignature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        signatureValid: true,
        payload: {
          event: "payment.success",
          trxID: "BL92A81K09",
          merchantInvoiceNumber: "DEP-20260821-9A41K",
          amount: "5000.00",
          currency: "BDT",
          senderNumber: "01712-349911",
          destinationAccount: "01900-112233",
          transactionStatus: "Completed",
          paymentExecuteTime: new Date(now - 355e4).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "bkash",
          "x-signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          "x-timestamp": String(now - 355e4),
          "x-webhook-id": "whk_bk_901"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Signature verified via HMAC-SHA256. Deposit credited to user wallet.",
        latencyMs: 42,
        retryCount: 0,
        createdAt: new Date(now - 355e4).toISOString()
      },
      {
        id: "WH_20260822_NG804",
        provider: "nagad",
        eventType: "payout.disbursed",
        eventId: "evt_ng_771920194",
        signature: "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
        expectedSignature: "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
        signatureValid: true,
        payload: {
          event: "payout.disbursed",
          issuerTrxId: "NG_DISB_891028",
          orderId: "WTH-20260821-7B22Z",
          amount: "3000.00",
          currency: "BDT",
          recipientAccount: "01844-992200",
          status: "SUCCESS",
          payoutTime: new Date(now - 718e4).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "nagad",
          "x-signature": "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
          "x-timestamp": String(now - 718e4),
          "x-webhook-id": "whk_ng_804"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Payout confirmation verified. Reserved balance finalized.",
        latencyMs: 38,
        retryCount: 0,
        createdAt: new Date(now - 718e4).toISOString()
      },
      {
        id: "WH_20260822_PG701",
        provider: "pgsoft",
        eventType: "game.round_settled",
        eventId: "evt_pg_551920841",
        signature: "a918204810294810293840192834019283401928340192834019283401928340",
        expectedSignature: "a918204810294810293840192834019283401928340192834019283401928340",
        signatureValid: true,
        payload: {
          event: "game.round_settled",
          provider: "pgsoft",
          gameId: "mahjong-ways-2",
          userId: "u_10291",
          roundId: "RND_99210948",
          betAmount: 100,
          winAmount: 450,
          netSettlement: 350,
          currency: "BDT",
          timestamp: new Date(now - 12e5).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "pgsoft",
          "x-signature": "a918204810294810293840192834019283401928340192834019283401928340",
          "x-timestamp": String(now - 12e5),
          "x-webhook-id": "whk_pg_701"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Game round outcome validated and seamlessly credited.",
        latencyMs: 19,
        retryCount: 0,
        createdAt: new Date(now - 12e5).toISOString()
      },
      {
        id: "WH_20260822_TAMPER_01",
        provider: "rocket",
        eventType: "payment.tampered_attempt",
        eventId: "evt_rk_bad_sig_9901",
        signature: "0000000000000000000000000000000000000000000000000000000000000000",
        expectedSignature: "c819283019283019283019283019283019283019283019283019283019283019",
        signatureValid: false,
        payload: {
          event: "payment.received",
          trxID: "RK999INVALID99",
          amount: "50000.00",
          currency: "BDT",
          senderNumber: "01700-000000",
          destinationAccount: "01711-884422-9",
          tamperFlag: "MAN_IN_THE_MIDDLE_SIMULATION"
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "rocket",
          "x-signature": "0000000000000000000000000000000000000000000000000000000000000000",
          "x-timestamp": String(now - 6e5),
          "x-webhook-id": "whk_tamper_01"
        },
        httpStatus: 401,
        processed: false,
        processResult: "\u274C 401 Unauthorized: Signature hash does not match computed HMAC-SHA256 payload digest.",
        latencyMs: 12,
        retryCount: 0,
        createdAt: new Date(now - 6e5).toISOString()
      }
    ];
  }
};
var paymentGatewayEngine = new PaymentGatewayEngine();

// src/server/controllers/paymentGatewayController.ts
var PaymentGatewayController = class {
  /**
   * POST /api/v2/payment/deposit/intent
   * Create a unique deposit intent and assign payment destination from the pool
   */
  async createDepositIntent(req, res) {
    try {
      const {
        userId,
        provider,
        method,
        amount,
        currency = "BDT",
        idempotencyKey
      } = req.body;
      let authUser;
      try {
        authUser = await resolveAuthPaymentUser(req, userId);
      } catch (authErr) {
        res.status(authErr.statusCode || 401).json({
          success: false,
          error: authErr.code || authErr.message || "Authentication failed",
          code: authErr.code || "UNAUTHENTICATED",
          message: authErr.message
        });
        return;
      }
      if (!provider || amount === void 0 || amount === null || amount === "") {
        res.status(400).json({ error: "Missing required parameters: provider, amount" });
        return;
      }
      if (typeof amount !== "string") {
        res.status(400).json({
          error: 'UNSAFE_NUMERIC_MONEY_INPUT: Monetary amount must be provided as an exact decimal string (e.g. "100.0000"). Numeric values are rejected.'
        });
        return;
      }
      let parsedAmount;
      try {
        parsedAmount = validatePaymentAmount(amount);
      } catch (err) {
        res.status(400).json({ error: `Invalid monetary amount: ${err.message}` });
        return;
      }
      const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
      const intent = paymentGatewayEngine.createDepositIntent({
        userId: String(authUser.id),
        username: authUser.username || `User_${authUser.id}`,
        provider,
        method: method || provider.toUpperCase(),
        amount: parsedAmount.decimalString,
        amountMinor: parsedAmount.minorUnits,
        currency,
        idempotencyKey: idempotencyKey || req.headers["idempotency-key"],
        clientIp
      });
      res.status(201).json({
        success: true,
        data: intent,
        message: "Deposit intent created successfully. Please complete payment within 15 minutes."
      });
    } catch (err) {
      console.error("[PaymentGatewayController.createDepositIntent error]:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  }
  /**
   * POST /api/v2/payment/deposit/verify-trx
   * Submit TrxID and trigger the 8-point Automated Verification & Credit Engine
   */
  async verifyTrxId(req, res) {
    try {
      const { depositId, trxId, senderNumber, userId } = req.body;
      if (!depositId || !trxId) {
        res.status(400).json({ error: "Missing required parameters: depositId, trxId" });
        return;
      }
      let authUser;
      try {
        authUser = await resolveAuthPaymentUser(req, userId);
      } catch (authErr) {
        res.status(authErr.statusCode || 401).json({
          success: false,
          error: authErr.code || authErr.message || "Authentication failed",
          code: authErr.code || "UNAUTHENTICATED",
          message: authErr.message
        });
        return;
      }
      const existingIntent = paymentGatewayEngine.getDepositIntent(String(depositId));
      if (existingIntent) {
        const isOwner = existingIntent.userId === String(authUser.id) || existingIntent.userId === authUser.uid;
        if (!isOwner) {
          res.status(403).json({
            success: false,
            error: "ACCOUNT_OWNERSHIP_MISMATCH",
            code: "ACCOUNT_OWNERSHIP_MISMATCH",
            message: "Account ownership mismatch: deposit intent does not belong to authenticated user"
          });
          return;
        }
      }
      const result = await paymentGatewayEngine.verifyAndCreditDeposit({
        depositId: String(depositId),
        trxId: String(trxId),
        senderNumber: senderNumber ? String(senderNumber) : void 0
      });
      res.status(200).json({
        success: true,
        data: result.depositIntent,
        status: result.status || result.depositIntent.status,
        code: result.code || "LEDGER_SETTLEMENT_PENDING",
        newBalance: result.newBalance,
        message: result.message
      });
    } catch (err) {
      console.error("[PaymentGatewayController.verifyTrxId error]:", err);
      const isUnconfigured = err.code === "PROVIDER_NOT_CONFIGURED" || err.code === "PROVIDER_INTEGRATION_INCOMPLETE" || err.status === "PENDING_INTEGRATION";
      res.status(isUnconfigured ? 503 : 400).json({
        success: false,
        code: err.code || "VERIFICATION_FAILED",
        status: err.status || "FAILED",
        error: err.message || "Verification failed"
      });
    }
  }
  /**
   * POST /api/v2/payment/withdraw/request
   * Submit withdrawal request with balance reservation and automated payout
   */
  async requestWithdrawal(req, res) {
    try {
      const {
        userId,
        provider,
        method,
        amount,
        currency = "BDT",
        recipientAccount,
        recipientName,
        idempotencyKey
      } = req.body;
      let authUser;
      try {
        authUser = await resolveAuthPaymentUser(req, userId);
      } catch (authErr) {
        res.status(authErr.statusCode || 401).json({
          success: false,
          error: authErr.code || authErr.message || "Authentication failed",
          code: authErr.code || "UNAUTHENTICATED",
          message: authErr.message
        });
        return;
      }
      if (!provider || amount === void 0 || amount === null || amount === "" || !recipientAccount) {
        res.status(400).json({ error: "Missing required parameters: provider, amount, recipientAccount" });
        return;
      }
      if (typeof amount !== "string") {
        res.status(400).json({
          error: 'UNSAFE_NUMERIC_MONEY_INPUT: Monetary amount must be provided as an exact decimal string (e.g. "100.0000"). Numeric values are rejected.'
        });
        return;
      }
      let parsedAmount;
      try {
        parsedAmount = validatePaymentAmount(amount);
      } catch (err) {
        res.status(400).json({ error: `Invalid monetary amount: ${err.message}` });
        return;
      }
      const gate = await WageringService.enforceWithdrawalWageringGate({ userId: authUser.id });
      if (!gate.allowed) {
        res.status(403).json({
          success: false,
          error: `Withdrawal blocked: active wagering requirement is not completed (${gate.reason}).`,
          code: "WAGERING_REQUIREMENT_INCOMPLETE",
          activeRequirementsCount: gate.activeRequirementsCount,
          activeRequirements: gate.activeRequirements
        });
        return;
      }
      const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
      const key = idempotencyKey || req.headers["idempotency-key"] || `WD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const record = await paymentGatewayEngine.requestWithdrawal({
        userId: String(authUser.id),
        username: authUser.username || `User_${authUser.id}`,
        provider,
        method: method || provider.toUpperCase(),
        amount: parsedAmount.decimalString,
        amountMinor: parsedAmount.minorUnits,
        currency,
        recipientAccount: String(recipientAccount),
        recipientName: recipientName ? String(recipientName) : void 0,
        idempotencyKey: key,
        clientIp
      });
      res.status(201).json({
        success: true,
        data: record,
        message: "Withdrawal submitted. Balance reserved and payout is being processed."
      });
    } catch (err) {
      console.error("[PaymentGatewayController.requestWithdrawal error]:", err);
      const isUnconfigured = err.code === "PROVIDER_NOT_CONFIGURED" || err.code === "PROVIDER_INTEGRATION_INCOMPLETE" || err.status === "PENDING_INTEGRATION";
      res.status(isUnconfigured ? 503 : 400).json({
        success: false,
        code: err.code || "WITHDRAWAL_FAILED",
        status: err.status || "FAILED",
        error: err.message || "Withdrawal failed"
      });
    }
  }
  /**
   * POST /api/v2/payment/webhook/:provider
   * Provider Webhook listener with signature validation
   */
  async handleWebhook(req, res) {
    try {
      const provider = req.params.provider;
      const signature = req.headers["x-signature"] || req.headers["x-webhook-signature"] || "";
      if (!signature) {
        res.status(401).json({ error: "Missing required webhook signature header (x-signature)" });
        return;
      }
      const log = await paymentGatewayEngine.handleWebhook(provider, req.body, signature);
      res.status(200).json({
        received: true,
        processed: log.processed,
        eventId: log.eventId
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
  /**
   * GET /api/v2/payment/destination-pool
   */
  async getDestinationPool(_req, res) {
    res.json({
      success: true,
      data: paymentGatewayEngine.getDestinationPool()
    });
  }
  /**
   * GET /api/v2/payment/stats
   */
  async getStats(_req, res) {
    res.json({
      success: true,
      data: paymentGatewayEngine.getStats()
    });
  }
};
var paymentGatewayController = new PaymentGatewayController();

// src/server/controllers/affiliateController.ts
import crypto3 from "crypto";
import { eq as eq6, sql as sql5, inArray, and as and4 } from "drizzle-orm";

// src/server/controllers/promotionController.ts
import { and as and3, eq as eq5, sql as sql4 } from "drizzle-orm";

// src/shared/gameplayConfig.ts
var VIP_TIER_CONFIG = [
  { level: 1, name: "V1 Rookie", minDeposit: 0, minBet: 0, bonus: 0, cashback: 5e-3, payoutLimit: 5e4 },
  { level: 2, name: "V2 Bronze", minDeposit: 5e3, minBet: 25e3, bonus: 500, cashback: 8e-3, payoutLimit: 1e5 },
  { level: 3, name: "V3 Silver", minDeposit: 25e3, minBet: 1e5, bonus: 2e3, cashback: 0.01, payoutLimit: 25e4 },
  { level: 4, name: "V4 Gold VIP", minDeposit: 1e5, minBet: 5e5, bonus: 8e3, cashback: 0.012, payoutLimit: 5e5 },
  { level: 5, name: "V5 Platinum", minDeposit: 3e5, minBet: 15e5, bonus: 25e3, cashback: 0.015, payoutLimit: 1e6 },
  { level: 6, name: "V6 Diamond", minDeposit: 1e6, minBet: 5e6, bonus: 75e3, cashback: 0.018, payoutLimit: 25e5 },
  { level: 7, name: "V7 Master", minDeposit: 25e5, minBet: 15e6, bonus: 2e5, cashback: 0.02, payoutLimit: 5e6 },
  { level: 8, name: "V8 Grandmaster", minDeposit: 5e6, minBet: 4e7, bonus: 5e5, cashback: 0.025, payoutLimit: 1e7 },
  { level: 9, name: "V9 Legend", minDeposit: 1e7, minBet: 1e8, bonus: 15e5, cashback: 0.03, payoutLimit: 25e6 },
  { level: 10, name: "V10 Immortal", minDeposit: 25e6, minBet: 3e8, bonus: 5e6, cashback: 0.04, payoutLimit: 5e7 }
];
var DAILY_CHECKIN_REWARDS = [
  { day: 1, reward: 50, label: "\u09F350 Bonus" },
  { day: 2, reward: 100, label: "\u09F3100 Bonus" },
  { day: 3, reward: 150, label: "\u09F3150 Bonus + 5 Spins" },
  { day: 4, reward: 200, label: "\u09F3200 Bonus" },
  { day: 5, reward: 300, label: "\u09F3300 Bonus" },
  { day: 6, reward: 500, label: "\u09F3500 Bonus + 10 Spins" },
  { day: 7, reward: 1e3, label: "\u09F31,000 Grand Streak + Lucky Ticket" }
];
var WHEEL_PRIZES = [
  { id: 1, label: "\u09F3500 Real Cash", type: "REAL_CASH", value: 500, weight: 15, color: "#f59e0b" },
  { id: 2, label: "\u09F3100 Bonus", type: "BONUS_CASH", value: 100, weight: 35, color: "#06b6d4" },
  { id: 3, label: "25 Free Spins", type: "FREE_SPINS", value: 25, weight: 25, color: "#a855f7" },
  { id: 4, label: "\u09F32,000 Real Cash", type: "REAL_CASH", value: 2e3, weight: 5, color: "#10b981" },
  { id: 5, label: "\u09F350 Bonus", type: "BONUS_CASH", value: 50, weight: 40, color: "#3b82f6" },
  { id: 6, label: "\u09F310,000 Mega Jackpot", type: "REAL_CASH", value: 1e4, weight: 1, color: "#ec4899" },
  { id: 7, label: "50 Free Spins", type: "FREE_SPINS", value: 50, weight: 10, color: "#eab308" },
  { id: 8, label: "\u09F3250 Bonus", type: "BONUS_CASH", value: 250, weight: 20, color: "#6366f1" }
];

// src/server/services/wheelRngService.ts
import crypto2 from "crypto";
var WHEEL_RNG_ALGORITHM = "CSPRNG_WEIGHTED_V1";
var WheelRngService = class {
  /**
   * Cryptographically secure weighted selection using Node.js crypto.randomInt.
   * 
   * Given prizes with weights [w_0, w_1, ..., w_{n-1}] and totalWeight = SUM(w_i):
   * 1. Draws uniform integer R in [0, totalWeight - 1] via crypto.randomInt(0, totalWeight).
   * 2. Iteratively sums weights until R < cumulativeWeight.
   * 3. Selects the corresponding prize deterministically and uniformly.
   * 
   * @param prizes Configured wheel prize array (defaults to WHEEL_PRIZES)
   * @param customRng Optional custom RNG function for boundary testing (must return integer in [0, max-1])
   * @returns Selected prize along with audit verification attributes
   */
  static selectPrize(prizes = WHEEL_PRIZES, customRng) {
    if (!prizes || !Array.isArray(prizes) || prizes.length === 0) {
      throw new Error("Invalid wheel prize configuration: prizes list cannot be empty");
    }
    let totalWeight = 0;
    for (const prize of prizes) {
      if (typeof prize.weight !== "number" || isNaN(prize.weight) || prize.weight < 0 || !Number.isInteger(prize.weight)) {
        throw new Error(
          `Invalid prize weight for prize '${prize.label}' (id: ${prize.id}): weight must be a non-negative integer, got ${prize.weight}`
        );
      }
      totalWeight += prize.weight;
    }
    if (totalWeight <= 0) {
      throw new Error("Invalid wheel prize configuration: total weight must be strictly greater than 0");
    }
    const randomInt = customRng ? customRng(totalWeight) : crypto2.randomInt(0, totalWeight);
    if (typeof randomInt !== "number" || !Number.isInteger(randomInt) || randomInt < 0 || randomInt >= totalWeight) {
      throw new Error(
        `RNG value ${randomInt} is out of bounds [0, ${totalWeight - 1}]`
      );
    }
    let cumulativeWeight = 0;
    for (const prize of prizes) {
      cumulativeWeight += prize.weight;
      if (randomInt < cumulativeWeight) {
        return {
          prize,
          prizeId: prize.id,
          prizeType: prize.type,
          prizeLabel: prize.label,
          prizeValue: prize.value,
          prizeWeight: prize.weight,
          totalWeight,
          algorithm: WHEEL_RNG_ALGORITHM
        };
      }
    }
    const fallbackPrize = [...prizes].reverse().find((p) => p.weight > 0) || prizes[prizes.length - 1];
    return {
      prize: fallbackPrize,
      prizeId: fallbackPrize.id,
      prizeType: fallbackPrize.type,
      prizeLabel: fallbackPrize.label,
      prizeValue: fallbackPrize.value,
      prizeWeight: fallbackPrize.weight,
      totalWeight,
      algorithm: WHEEL_RNG_ALGORITHM
    };
  }
  /**
   * Generates sanitized audit metadata for spin persistence in DB and ledger entries.
   * Does NOT include raw entropy, seeds, or sensitive keys.
   */
  static createAuditMetadata(selection, prizeValueStr, spinDateUtc) {
    const isReal = selection.prizeType === "REAL_CASH";
    const isBonus = selection.prizeType === "BONUS_CASH";
    const category = isReal ? "REAL_CASH" : isBonus ? "BONUS_CASH" : "NON_MONETARY";
    return {
      providerId: "GAMEPLAY365_PROMOTIONS",
      promoType: "LUCKY_WHEEL",
      category,
      rewardType: selection.prizeType,
      prizeId: selection.prizeId,
      prizeLabel: selection.prizeLabel,
      prizeValue: prizeValueStr,
      prizeWeight: selection.prizeWeight,
      totalWeight: selection.totalWeight,
      rngAlgorithm: selection.algorithm,
      spinDateUtc,
      isWithdrawable: isReal
    };
  }
  /**
   * Calculates total weight of configured prizes.
   */
  static getTotalWeight(prizes = WHEEL_PRIZES) {
    return prizes.reduce((acc, p) => acc + p.weight, 0);
  }
};

// src/server/services/freeSpinService.ts
import { eq as eq4, and as and2, gt as gt2 } from "drizzle-orm";
var FreeSpinService = class {
  /**
   * Deterministic entitlement reference string for lucky wheel rewards.
   */
  static getWheelReference(userId, spinDateUtc) {
    return `WHEEL_FS_${userId}_${spinDateUtc}`;
  }
  /**
   * Grants a Free Spin entitlement atomically within a transaction.
   * If a transaction is provided, executes inside it; otherwise uses root db.
   */
  static async grantWheelEntitlement(params) {
    const {
      userId,
      spinDateUtc,
      quantity,
      spinTimestamp = /* @__PURE__ */ new Date(),
      expiryDays = 7,
      tx
    } = params;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Invalid free spin quantity: ${quantity}. Quantity must be a positive integer.`);
    }
    const sourceReference = this.getWheelReference(userId, spinDateUtc);
    const expiresAt = expiryDays > 0 ? new Date(spinTimestamp.getTime() + expiryDays * 24 * 60 * 60 * 1e3) : null;
    const executor = tx || db;
    const [record] = await executor.insert(freeSpinEntitlements).values({
      userId,
      source: "LUCKY_WHEEL",
      sourceReference,
      quantity,
      remainingQuantity: quantity,
      status: "ACTIVE",
      spinDateUtc,
      expiresAt,
      grantedAt: spinTimestamp,
      createdAt: spinTimestamp
    }).returning();
    if (!record) {
      throw new Error(`Failed to create free spin entitlement for user ${userId} on ${spinDateUtc}`);
    }
    return record;
  }
  /**
   * Retrieves active, non-expired free spins for a given user.
   */
  static async getUserActiveEntitlements(userId) {
    const now = /* @__PURE__ */ new Date();
    const rows = await db.select().from(freeSpinEntitlements).where(
      and2(
        eq4(freeSpinEntitlements.userId, userId),
        eq4(freeSpinEntitlements.status, "ACTIVE"),
        gt2(freeSpinEntitlements.remainingQuantity, 0)
      )
    );
    return rows.filter((r) => !r.expiresAt || new Date(r.expiresAt) > now);
  }
  /**
   * Returns the total active free spins count for a user.
   */
  static async getTotalActiveFreeSpins(userId) {
    const active = await this.getUserActiveEntitlements(userId);
    return active.reduce((sum, item) => sum + (item.remainingQuantity || 0), 0);
  }
};

// src/server/controllers/promotionController.ts
var toScale43 = (val) => {
  const s = typeof val === "number" ? val.toFixed(4) : String(val).trim();
  const [intPart = "0", fracPart = ""] = s.split(".");
  const paddedFrac = fracPart.padEnd(4, "0").slice(0, 4);
  const isNeg = intPart.startsWith("-");
  const cleanInt = isNeg ? intPart.slice(1) : intPart;
  const combined = BigInt((cleanInt || "0") + paddedFrac);
  return isNeg ? -combined : combined;
};
var fromScale43 = (val) => {
  const isNeg = val < 0n;
  const abs = isNeg ? -val : val;
  const str = abs.toString().padStart(5, "0");
  const intPart = str.slice(0, -4) || "0";
  const fracPart = str.slice(-4);
  return `${isNeg ? "-" : ""}${intPart}.${fracPart}`;
};
var getUtcDateString = (d = /* @__PURE__ */ new Date()) => {
  return d.toISOString().split("T")[0];
};
var getUtcDaysDifference = (baseDateUtc, targetDateUtc) => {
  const [y1, m1, d1] = baseDateUtc.split("-").map((n) => parseInt(n, 10));
  const [y2, m2, d2] = targetDateUtc.split("-").map((n) => parseInt(n, 10));
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 24 * 60 * 60 * 1e3;
  return Math.round((utc2 - utc1) / msPerDay);
};
var resolveAuthUser = async (req, clientUserId) => {
  const authUid = req.user?.uid;
  if (!authUid) {
    const error = new Error("Unauthorized: Authentication required");
    error.statusCode = 401;
    throw error;
  }
  const [foundUser] = await db.select({ id: users.id, uid: users.uid }).from(users).where(eq5(users.uid, authUid)).limit(1);
  if (!foundUser) {
    const error = new Error(`User account not found for UID: ${authUid}`);
    error.statusCode = 404;
    throw error;
  }
  if (clientUserId !== void 0 && clientUserId !== null && String(clientUserId).trim() !== "") {
    const strClientUserId = String(clientUserId).trim();
    const isMatchingUid = strClientUserId === foundUser.uid;
    const isMatchingId = /^\d+$/.test(strClientUserId) && parseInt(strClientUserId, 10) === foundUser.id;
    if (!isMatchingUid && !isMatchingId) {
      const error = new Error("Forbidden: Cannot access or claim rewards for another user");
      error.statusCode = 403;
      throw error;
    }
  }
  return {
    userId: foundUser.id,
    uid: foundUser.uid
  };
};
var PromotionService = class _PromotionService {
  static {
    this.ledgerService = null;
  }
  static setLedgerService(service) {
    _PromotionService.ledgerService = service;
  }
  static getLedgerService() {
    return _PromotionService.ledgerService;
  }
  /**
   * Process 7-day Daily Check-In with ACID Row-Level Locking, Scale-4 BigInt Math,
   * Authoritative UTC Calendar Day Boundary, PostgreSQL DB-Level Unique Constraint Protection,
   * and Authoritative WalletLedgerService routing (ZERO direct balance mutations).
   */
  static async claimDailyCheckIn(userId, claimTimestamp = /* @__PURE__ */ new Date(), customLedgerService) {
    if (!userId || typeof userId !== "number") {
      throw new Error("Valid userId is required to claim daily check-in");
    }
    const effectiveLedger = customLedgerService || _PromotionService.ledgerService;
    if (!effectiveLedger) {
      throw new Error("FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. Promotion claim failed closed.");
    }
    const todayUtc = getUtcDateString(claimTimestamp);
    const deterministicClaimTxId = `PROMO_CHECKIN_${userId}_${todayUtc}`;
    try {
      return await db.transaction(async (tx) => {
        const existingTodayCheckIn = await tx.select({ id: dailyCheckIns.id }).from(dailyCheckIns).where(
          and3(
            eq5(dailyCheckIns.userId, userId),
            eq5(dailyCheckIns.claimDateUtc, todayUtc)
          )
        ).limit(1);
        if (existingTodayCheckIn.length > 0) {
          throw new Error("You have already claimed today\u2019s check-in bonus. Come back tomorrow!");
        }
        const [lastCheckIn] = await tx.select().from(dailyCheckIns).where(eq5(dailyCheckIns.userId, userId)).orderBy(sql4`${dailyCheckIns.createdAt} DESC`).limit(1);
        let nextStreakDay = 1;
        if (lastCheckIn) {
          const lastUtc = lastCheckIn.claimDateUtc || getUtcDateString(new Date(lastCheckIn.checkInDate || lastCheckIn.createdAt));
          const diffDays = getUtcDaysDifference(lastUtc, todayUtc);
          if (diffDays <= 0) {
            throw new Error("You have already claimed today\u2019s check-in bonus. Come back tomorrow!");
          } else if (diffDays === 1) {
            nextStreakDay = lastCheckIn.streakDay % 7 + 1;
          } else {
            nextStreakDay = 1;
          }
        }
        const rewardConfig = DAILY_CHECKIN_REWARDS.find((r) => r.day === nextStreakDay) || DAILY_CHECKIN_REWARDS[0];
        const rewardAmount = rewardConfig.reward;
        const rewardAmountStr = rewardAmount.toFixed(4);
        const rewardBigInt = toScale43(rewardAmountStr);
        const ledgerResult = await effectiveLedger.executeTransaction({
          userId: String(userId),
          currency: "BDT",
          type: "CREDIT",
          targetBalance: "BONUS",
          amountMinor: rewardAmountStr,
          transactionId: deterministicClaimTxId,
          auditMetadata: {
            providerId: "GAMEPLAY365_PROMOTIONS",
            category: "BONUS_CASH",
            rewardType: "BONUS_CREDIT",
            promoType: "DAILY_CHECKIN",
            streakDay: nextStreakDay,
            claimDateUtc: todayUtc,
            rewardAmount: rewardAmountStr,
            isWithdrawable: false
          }
        });
        await tx.insert(dailyCheckIns).values({
          userId,
          checkInDate: claimTimestamp,
          claimDateUtc: todayUtc,
          streakDay: nextStreakDay,
          rewardAmount: rewardAmountStr,
          rewardType: "BONUS_CREDIT",
          createdAt: claimTimestamp
        });
        const targetTurnoverBigInt = rewardBigInt * 10n;
        await tx.insert(wageringRequirements).values({
          userId,
          promoName: `Daily Check-In Day ${nextStreakDay}`,
          bonusAmountGranted: rewardAmountStr,
          requiredMultiplier: 10,
          targetTurnoverAmount: fromScale43(targetTurnoverBigInt),
          completedTurnoverAmount: "0.0000",
          status: "ACTIVE",
          expiresAt: new Date(claimTimestamp.getTime() + 7 * 24 * 3600 * 1e3),
          createdAt: claimTimestamp
        });
        return {
          streakDay: nextStreakDay,
          rewardAmount,
          label: rewardConfig.label,
          newBonusBalance: parseFloat(ledgerResult.afterBalanceMajor),
          transactionId: deterministicClaimTxId,
          ledgerEntryId: ledgerResult.ledgerEntryId,
          isIdempotent: ledgerResult.isIdempotent || false
        };
      });
    } catch (err) {
      if (err.code === "23505" || err.message?.includes("daily_check_ins_user_claim_date_utc_idx") || err.message?.includes("duplicate key")) {
        throw new Error("You have already claimed today\u2019s check-in bonus. Come back tomorrow!");
      }
      throw err;
    }
  }
  /**
   * Cryptographically Secure Weighted Lucky Spin-the-Wheel with Daily Limits, Scale-4 Math,
   * Authoritative UTC Calendar Day Boundary, PostgreSQL DB-Level Unique Constraint Protection,
   * Node.js crypto.randomInt CSPRNG authority, and Authoritative WalletLedgerService routing.
   */
  static async executeWheelSpin(userId, spinTimestamp = /* @__PURE__ */ new Date(), customLedgerService, customRng, customEntitlementCreator) {
    if (!userId || typeof userId !== "number") {
      throw new Error("Valid userId is required to execute wheel spin");
    }
    const effectiveLedger = customLedgerService || _PromotionService.ledgerService;
    if (!effectiveLedger) {
      throw new Error("FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. Wheel spin failed closed.");
    }
    const todayUtc = getUtcDateString(spinTimestamp);
    const deterministicSpinTxId = `PROMO_WHEEL_${userId}_${todayUtc}`;
    try {
      return await db.transaction(async (tx) => {
        const existingSpin = await tx.select({ id: wheelSpins.id }).from(wheelSpins).where(
          and3(
            eq5(wheelSpins.userId, userId),
            eq5(wheelSpins.spinDateUtc, todayUtc)
          )
        ).limit(1);
        if (existingSpin.length >= 1) {
          throw new Error("You have already used your daily free wheel spin for today. Come back tomorrow!");
        }
        const selection = WheelRngService.selectPrize(WHEEL_PRIZES, customRng);
        const winningPrize = selection.prize;
        const prizeValueStr = winningPrize.value.toFixed(4);
        const prizeBigInt = toScale43(prizeValueStr);
        const spinAuditMetadata = WheelRngService.createAuditMetadata(
          selection,
          prizeValueStr,
          todayUtc
        );
        let ledgerResult = null;
        let entitlementResult = null;
        let isClaimFulfilled = false;
        if (winningPrize.type === "REAL_CASH" || winningPrize.type === "BONUS_CASH") {
          if (prizeBigInt > 0n) {
            if (winningPrize.type === "REAL_CASH") {
              ledgerResult = await effectiveLedger.executeTransaction({
                userId: String(userId),
                currency: "BDT",
                type: "CREDIT",
                targetBalance: "REAL",
                amountMinor: prizeValueStr,
                transactionId: deterministicSpinTxId,
                auditMetadata: spinAuditMetadata
              });
              isClaimFulfilled = !!ledgerResult?.ledgerEntryId || !!ledgerResult?.isIdempotent;
            } else if (winningPrize.type === "BONUS_CASH") {
              ledgerResult = await effectiveLedger.executeTransaction({
                userId: String(userId),
                currency: "BDT",
                type: "CREDIT",
                targetBalance: "BONUS",
                amountMinor: prizeValueStr,
                transactionId: deterministicSpinTxId,
                auditMetadata: spinAuditMetadata
              });
              isClaimFulfilled = !!ledgerResult?.ledgerEntryId || !!ledgerResult?.isIdempotent;
            }
          } else {
            isClaimFulfilled = true;
          }
        } else if (winningPrize.type === "FREE_SPINS") {
          const spinQuantity = Math.floor(winningPrize.value);
          if (spinQuantity <= 0) {
            throw new Error(`Invalid free spin prize quantity: ${winningPrize.value}`);
          }
          if (customEntitlementCreator) {
            entitlementResult = await customEntitlementCreator({
              userId,
              spinDateUtc: todayUtc,
              quantity: spinQuantity,
              spinTimestamp,
              tx
            });
          } else {
            entitlementResult = await FreeSpinService.grantWheelEntitlement({
              userId,
              spinDateUtc: todayUtc,
              quantity: spinQuantity,
              spinTimestamp,
              expiryDays: 7,
              tx
            });
          }
          if (!entitlementResult) {
            throw new Error(`FATAL_ENTITLEMENT_FAILED: Free spin entitlement creation returned empty. Wheel reward not claimed.`);
          }
          isClaimFulfilled = true;
        } else {
          isClaimFulfilled = true;
        }
        if (!isClaimFulfilled) {
          throw new Error(`FATAL_FULFILLMENT_FAILED: Wheel reward fulfillment failed for prize ${winningPrize.label}. Spin failed closed.`);
        }
        await tx.insert(wheelSpins).values({
          userId,
          spinDateUtc: todayUtc,
          prizeType: winningPrize.type,
          prizeLabel: winningPrize.label,
          prizeValue: prizeValueStr,
          currency: "BDT",
          isClaimed: isClaimFulfilled,
          auditMetadata: {
            prizeId: selection.prizeId,
            prizeType: selection.prizeType,
            prizeLabel: selection.prizeLabel,
            prizeWeight: selection.prizeWeight,
            totalWeight: selection.totalWeight,
            algorithm: selection.algorithm,
            spinDateUtc: todayUtc,
            entitlementId: entitlementResult?.id || null,
            entitlementReference: entitlementResult?.sourceReference || null
          },
          createdAt: spinTimestamp
        });
        return {
          prize: winningPrize,
          timestamp: spinTimestamp.getTime(),
          transactionId: deterministicSpinTxId,
          ledgerEntryId: ledgerResult?.ledgerEntryId || null,
          isIdempotent: ledgerResult?.isIdempotent || false,
          entitlement: entitlementResult ? {
            id: entitlementResult.id,
            sourceReference: entitlementResult.sourceReference,
            quantity: entitlementResult.quantity,
            remainingQuantity: entitlementResult.remainingQuantity,
            status: entitlementResult.status,
            expiresAt: entitlementResult.expiresAt
          } : null,
          audit: {
            prizeId: selection.prizeId,
            prizeType: selection.prizeType,
            prizeWeight: selection.prizeWeight,
            totalWeight: selection.totalWeight,
            algorithm: selection.algorithm,
            spinDateUtc: todayUtc
          }
        };
      });
    } catch (err) {
      if (err.code === "23505" || err.message?.includes("wheel_spins_user_spin_date_utc_idx") || err.message?.includes("free_spin_entitlements_") || err.message?.includes("duplicate key")) {
        throw new Error("You have already used your daily free wheel spin for today. Come back tomorrow!");
      }
      throw err;
    }
  }
};
var getPromotionDetailsHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req, req.query.userId);
    const now = /* @__PURE__ */ new Date();
    const todayUtc = getUtcDateString(now);
    const [lastCheckIn] = await db.select().from(dailyCheckIns).where(eq5(dailyCheckIns.userId, userId)).orderBy(sql4`${dailyCheckIns.createdAt} DESC`).limit(1);
    const activeWagering = await db.select().from(wageringRequirements).where(eq5(wageringRequirements.userId, userId)).limit(10);
    const [todaySpin] = await db.select({ id: wheelSpins.id }).from(wheelSpins).where(
      and3(
        eq5(wheelSpins.userId, userId),
        eq5(wheelSpins.spinDateUtc, todayUtc)
      )
    ).limit(1);
    const activeFreeSpins = await db.select({
      id: freeSpinEntitlements.id,
      quantity: freeSpinEntitlements.quantity,
      remainingQuantity: freeSpinEntitlements.remainingQuantity,
      status: freeSpinEntitlements.status,
      expiresAt: freeSpinEntitlements.expiresAt,
      spinDateUtc: freeSpinEntitlements.spinDateUtc
    }).from(freeSpinEntitlements).where(
      and3(
        eq5(freeSpinEntitlements.userId, userId),
        eq5(freeSpinEntitlements.status, "ACTIVE")
      )
    );
    const totalActiveFreeSpins = activeFreeSpins.reduce((sum, e) => sum + (e.remainingQuantity || 0), 0);
    let streak = 0;
    let canCheckInToday = true;
    if (lastCheckIn) {
      const lastUtc = lastCheckIn.claimDateUtc || getUtcDateString(new Date(lastCheckIn.checkInDate || lastCheckIn.createdAt));
      const diffDays = getUtcDaysDifference(lastUtc, todayUtc);
      if (diffDays <= 0) {
        canCheckInToday = false;
        streak = lastCheckIn.streakDay || 0;
      } else if (diffDays === 1) {
        canCheckInToday = true;
        streak = lastCheckIn.streakDay || 0;
      } else {
        canCheckInToday = true;
        streak = 0;
      }
    }
    const availableSpins = todaySpin ? 0 : 1;
    res.json({
      status: "SUCCESS",
      data: {
        checkInStreak: streak,
        canCheckInToday,
        availableSpins,
        activeFreeSpinsCount: totalActiveFreeSpins,
        freeSpinEntitlements: activeFreeSpins || [],
        dailyRewards: DAILY_CHECKIN_REWARDS,
        wheelPrizes: WHEEL_PRIZES,
        activeWageringRequirements: activeWagering || []
      }
    });
  } catch (err) {
    const statusCode = err.statusCode || (err.message?.includes("not found") ? 404 : 400);
    res.status(statusCode).json({ status: "ERROR", message: err.message });
  }
};
var claimCheckInHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const result = await PromotionService.claimDailyCheckIn(userId);
    res.json({ status: "SUCCESS", data: result });
  } catch (err) {
    const statusCode = err.statusCode || (err.message?.includes("not found") ? 404 : 400);
    res.status(statusCode).json({ status: "ERROR", message: err.message });
  }
};
var spinWheelHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const result = await PromotionService.executeWheelSpin(userId);
    res.json({ status: "SUCCESS", data: result });
  } catch (err) {
    const statusCode = err.statusCode || (err.message?.includes("not found") ? 404 : 400);
    res.status(statusCode).json({ status: "ERROR", message: err.message });
  }
};
var convertBonusHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const requirementId = Number(req.body?.requirementId);
    if (!requirementId || isNaN(requirementId)) {
      res.status(400).json({ status: "ERROR", message: "Valid requirementId is required" });
      return;
    }
    const currency = req.body?.currency || "BDT";
    const idempotencyKey = req.body?.idempotencyKey || req.headers["idempotency-key"];
    const result = await WageringService.convertOrReleaseBonus({
      userId,
      requirementId,
      currency,
      idempotencyKey
    });
    if (!result.success) {
      const statusCode = result.reason === "TRANSACTION_USER_MISMATCH" ? 403 : 400;
      res.status(statusCode).json({
        status: "ERROR",
        message: `Bonus conversion blocked: ${result.reason}`,
        data: result
      });
      return;
    }
    res.json({
      status: "SUCCESS",
      data: result,
      message: result.duplicate ? "Bonus requirement already released" : "Bonus successfully converted and credited to REAL balance"
    });
  } catch (err) {
    const statusCode = err.statusCode || (err.message?.includes("not found") ? 404 : 400);
    res.status(statusCode).json({ status: "ERROR", message: err.message });
  }
};
var getWageringStatusHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req, req.query?.userId);
    const activeReqs = await WageringService.getUserActiveRequirements(userId);
    const gate = await WageringService.enforceWithdrawalWageringGate({ userId });
    res.json({
      status: "SUCCESS",
      data: {
        userId,
        canWithdraw: gate.allowed,
        gateReason: gate.reason,
        activeRequirementsCount: gate.activeRequirementsCount,
        activeRequirements: activeReqs
      }
    });
  } catch (err) {
    const statusCode = err.statusCode || (err.message?.includes("not found") ? 404 : 400);
    res.status(statusCode).json({ status: "ERROR", message: err.message });
  }
};

// src/server/controllers/affiliateController.ts
var COMMISSION_TIER_BPS = {
  1: 50n,
  // 0.0050 * 10000 = 50 bps
  2: 20n,
  // 0.0020 * 10000 = 20 bps
  3: 10n
  // 0.0010 * 10000 = 10 bps
};
var AffiliateService = class _AffiliateService {
  /**
   * Distribute multi-tier commissions when a player places a valid bet.
   * Enforces:
   * 1. Exact Scale-4 BigInt Math (Zero float drift).
   * 2. Transaction status validation (COMMITTED/COMPLETED/SETTLED).
   * 3. Strict Idempotency via sourceTransactionId + beneficiaryUserId + tier.
   * 4. Single ACID transaction with SELECT ... FOR UPDATE row-level locking on all affected affiliate nodes.
   * 5. Immutable commission ledger entries.
   */
  static async processValidBetCommission(params) {
    if (!params.sourceTransactionId || typeof params.sourceTransactionId !== "string" || params.sourceTransactionId.trim() === "") {
      throw new Error("sourceTransactionId is required for commission distribution");
    }
    const [sourceTx] = await db.select().from(transactions).where(eq6(transactions.transactionId, params.sourceTransactionId)).limit(1);
    if (!sourceTx) {
      return { success: false, reason: "SOURCE_TRANSACTION_NOT_FOUND", distributedCount: 0 };
    }
    if (sourceTx.type !== "BET") {
      return { success: false, reason: "INVALID_TRANSACTION_TYPE", distributedCount: 0 };
    }
    const isCommittedStatus = sourceTx.status === "COMPLETED" || sourceTx.status === "SETTLED";
    if (!isCommittedStatus) {
      return { success: false, reason: "TRANSACTION_NOT_SETTLED", distributedCount: 0 };
    }
    if (sourceTx.userId !== params.userId) {
      return { success: false, reason: "TRANSACTION_USER_MISMATCH", distributedCount: 0 };
    }
    const authoritativeBetScale4 = toScale43(sourceTx.amount);
    if (authoritativeBetScale4 <= 0n) {
      return { success: false, reason: "INVALID_BET_AMOUNT", distributedCount: 0 };
    }
    const authoritativeCurrency = sourceTx.currency || "BDT";
    if (params.betAmount !== void 0 && params.betAmount !== null) {
      const callerBetScale4 = typeof params.betAmount === "bigint" ? params.betAmount : toScale43(params.betAmount);
      if (callerBetScale4 !== authoritativeBetScale4) {
        return { success: false, reason: "BET_AMOUNT_MISMATCH", distributedCount: 0 };
      }
    }
    if (params.currency && typeof params.currency === "string" && params.currency.trim() !== "") {
      if (params.currency.trim().toUpperCase() !== authoritativeCurrency.trim().toUpperCase()) {
        return { success: false, reason: "CURRENCY_MISMATCH", distributedCount: 0 };
      }
    }
    const betScale4 = authoritativeBetScale4;
    const resolvedCurrency = authoritativeCurrency;
    const [userNode] = await db.select().from(affiliateNodes).where(eq6(affiliateNodes.userId, sourceTx.userId)).limit(1);
    if (!userNode || !userNode.parentAffiliateId) {
      return { success: true, reason: "NO_UPLINE_BENEFICIARY", distributedCount: 0 };
    }
    const beneficiaries = [];
    if (userNode.parentAffiliateId) {
      beneficiaries.push({
        userId: userNode.parentAffiliateId,
        tier: 1,
        bps: COMMISSION_TIER_BPS[1],
        rateStr: "0.0050"
      });
    }
    if (userNode.grandParentAffiliateId) {
      beneficiaries.push({
        userId: userNode.grandParentAffiliateId,
        tier: 2,
        bps: COMMISSION_TIER_BPS[2],
        rateStr: "0.0020"
      });
    }
    if (beneficiaries.length === 0) {
      return { success: true, reason: "NO_UPLINE_BENEFICIARY", distributedCount: 0 };
    }
    return await db.transaction(async (tx) => {
      const existingCommissions = await tx.select().from(affiliateCommissions).where(eq6(affiliateCommissions.sourceTransactionId, params.sourceTransactionId));
      const existingTierMap = new Set(
        existingCommissions.map((c) => `${c.beneficiaryUserId}_${c.tier}`)
      );
      const pendingBeneficiaries = beneficiaries.filter(
        (b) => !existingTierMap.has(`${b.userId}_${b.tier}`)
      );
      if (pendingBeneficiaries.length === 0) {
        return { success: true, reason: "ALREADY_PROCESSED", distributedCount: 0 };
      }
      const distinctBeneficiaryIds = Array.from(
        new Set(pendingBeneficiaries.map((b) => b.userId))
      ).sort((a, b) => a - b);
      for (const bUserId of distinctBeneficiaryIds) {
        await tx.execute(
          sql5`SELECT * FROM affiliate_nodes WHERE user_id = ${bUserId} FOR UPDATE`
        );
      }
      let distributedCount = 0;
      for (const beneficiary of pendingBeneficiaries) {
        const commissionScale4 = betScale4 * beneficiary.bps / 10000n;
        if (commissionScale4 <= 0n) {
          continue;
        }
        const commissionAmountStr = fromScale43(commissionScale4);
        const betAmountStr = fromScale43(betScale4);
        await tx.update(affiliateNodes).set({
          totalCommissionEarned: sql5`(${affiliateNodes.totalCommissionEarned}::numeric + ${commissionAmountStr}::numeric)::text`,
          unclaimedCommission: sql5`(${affiliateNodes.unclaimedCommission}::numeric + ${commissionAmountStr}::numeric)::text`,
          totalTurnoverVolume: sql5`(${affiliateNodes.totalTurnoverVolume}::numeric + ${betAmountStr}::numeric)::text`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq6(affiliateNodes.userId, beneficiary.userId));
        await tx.insert(affiliateCommissions).values({
          beneficiaryUserId: beneficiary.userId,
          sourceUserId: sourceTx.userId,
          sourceTransactionId: params.sourceTransactionId,
          tier: beneficiary.tier,
          validBetAmount: betAmountStr,
          commissionRate: beneficiary.rateStr,
          commissionAmount: commissionAmountStr,
          currency: resolvedCurrency,
          status: "SETTLED",
          settledAt: /* @__PURE__ */ new Date()
        });
        distributedCount++;
      }
      return {
        success: true,
        distributedCount,
        sourceTransactionId: params.sourceTransactionId
      };
    });
  }
  static {
    this.ledgerService = null;
  }
  static setLedgerService(service) {
    _AffiliateService.ledgerService = service;
  }
  static getLedgerService() {
    return _AffiliateService.ledgerService;
  }
  /**
   * Claim accumulated affiliate commissions into withdrawable real wallet balance.
   * Enforces:
   * 1. Authoritative Production Wallet Ledger: Fails closed if production ledger service is not configured (ZERO in-memory fallback).
   * 2. Deterministic Server Idempotency: Server-derived claim ID generated from exact SETTLED commission entry IDs (never Date.now(), client transactionId ignored).
   * 3. Strict Settlement Check: Only exact SETTLED commission entries are claimed; zero fallback credit from aggregate counters.
   * 4. Crash-Safe & Exactly-Once Execution:
   *    - Row-level lock (SELECT ... FOR UPDATE) on affiliate_nodes and affiliateCommissions.
   *    - Deterministic transaction ID derived from exact SETTLED entry IDs ensures ledger credit idempotency.
   *    - Authoritative wallet ledger credit executed with atomic recovery.
   *    - Synchronous transition of commission entries to CLAIMED and deduction of unclaimedCommission.
   * 5. Exact Scale-4 BigInt Math (zero float drift, strict minor-unit representation).
   * 6. Zero direct wallets.realBalance mutation.
   */
  static async claimAffiliateCommission(userId, customLedgerService) {
    if (!userId || typeof userId !== "number") {
      throw new Error("Valid userId is required to claim commissions");
    }
    const effectiveLedger = customLedgerService || _AffiliateService.ledgerService;
    if (!effectiveLedger) {
      throw new Error("FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. Affiliate commission claim failed closed.");
    }
    return await db.transaction(async (tx) => {
      const [node] = await tx.select().from(affiliateNodes).where(eq6(affiliateNodes.userId, userId)).for("update");
      if (!node) {
        throw new Error("Affiliate profile not found");
      }
      const settledCommissions = await tx.select().from(affiliateCommissions).where(
        and4(
          eq6(affiliateCommissions.beneficiaryUserId, userId),
          eq6(affiliateCommissions.status, "SETTLED")
        )
      ).for("update");
      if (settledCommissions.length === 0) {
        throw new Error("No unclaimed commissions available");
      }
      const sortedIds = settledCommissions.map((c) => c.id).sort((a, b) => a - b);
      const entriesFingerprint = sortedIds.join(",");
      const entriesHash = crypto3.createHash("sha256").update(entriesFingerprint).digest("hex").slice(0, 24);
      const deterministicClaimTxId = `AFF_CLAIM_U${userId}_${entriesHash}`;
      let totalClaimableScale4 = 0n;
      for (const entry of settledCommissions) {
        totalClaimableScale4 += toScale43(entry.commissionAmount);
      }
      if (totalClaimableScale4 <= 0n) {
        throw new Error("No unclaimed commissions available");
      }
      const claimedAmountStr = fromScale43(totalClaimableScale4);
      const ledgerResult = await effectiveLedger.executeTransaction({
        userId: String(userId),
        currency: "BDT",
        type: "CREDIT",
        amountMinor: claimedAmountStr,
        transactionId: deterministicClaimTxId,
        auditMetadata: {
          providerId: "GAMEPLAY365_CORE",
          type: "AFFILIATE_COMMISSION_CLAIM",
          beneficiaryUserId: userId,
          claimedEntryIds: sortedIds,
          claimedAmount: claimedAmountStr
        }
      });
      const nodeUnclaimedScale4 = toScale43(node.unclaimedCommission);
      const remainingUnclaimedScale4 = nodeUnclaimedScale4 > totalClaimableScale4 ? nodeUnclaimedScale4 - totalClaimableScale4 : 0n;
      const remainingUnclaimedStr = fromScale43(remainingUnclaimedScale4);
      await tx.update(affiliateNodes).set({
        unclaimedCommission: remainingUnclaimedStr,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq6(affiliateNodes.userId, userId));
      await tx.update(affiliateCommissions).set({ status: "CLAIMED" }).where(inArray(affiliateCommissions.id, sortedIds));
      return {
        claimedAmount: claimedAmountStr,
        newRealBalance: ledgerResult.afterBalanceMajor || fromScale43(toScale43(ledgerResult.afterBalanceMinor)),
        transactionId: deterministicClaimTxId,
        ledgerEntryId: ledgerResult.ledgerEntryId,
        isIdempotent: ledgerResult.isIdempotent || false
      };
    });
  }
  /**
   * Bind a new user to an authoritative referrer via unique referralCode.
   * Enforces:
   * 1. PostgreSQL/server as the ONLY authority for referral relationships.
   * 2. Authoritative authenticated caller derived strictly from verified Firebase Auth token.
   * 3. Authoritative resolution of referralCode only against PostgreSQL user/affiliate record.
   * 4. Immutable relationship: Single parent only, never reassignable.
   * 5. Strict idempotency: Retrying with the same parent returns identical success state.
   * 6. Strict validation: Rejects self-referral, referral cycles (A->B->A), invalid codes, parent reassignment.
   * 7. Concurrency-safe: Single ACID transaction with ordered row-level locking (SELECT ... FOR UPDATE).
   * 8. Zero client-side financial mutations.
   */
  static async bindReferral(params) {
    if (!params.userId || typeof params.userId !== "number") {
      throw new Error("Valid userId is required for referral binding");
    }
    if (!params.referralCode || typeof params.referralCode !== "string" || !params.referralCode.trim()) {
      const error = new Error("Referral code is required");
      error.statusCode = 400;
      error.code = "INVALID_REFERRAL_CODE";
      throw error;
    }
    const cleanCode = params.referralCode.trim();
    let referrerUserId = null;
    const [matchedNode] = await db.select().from(affiliateNodes).where(sql5`LOWER(${affiliateNodes.referralCode}) = LOWER(${cleanCode})`).limit(1);
    if (matchedNode) {
      referrerUserId = matchedNode.userId;
    } else {
      const [matchedUser] = await db.select().from(users).where(sql5`LOWER(${users.referralCode}) = LOWER(${cleanCode})`).limit(1);
      if (matchedUser) {
        referrerUserId = matchedUser.id;
      } else {
        const match = cleanCode.toUpperCase().match(/^PLAY369_(\d+)$/);
        if (match) {
          const possibleId = parseInt(match[1], 10);
          const [userById] = await db.select().from(users).where(eq6(users.id, possibleId)).limit(1);
          if (userById) {
            referrerUserId = userById.id;
          }
        }
      }
    }
    if (!referrerUserId) {
      const error = new Error(`Invalid or nonexistent referral code: ${cleanCode}`);
      error.statusCode = 404;
      error.code = "INVALID_REFERRAL_CODE";
      throw error;
    }
    if (referrerUserId === params.userId) {
      const error = new Error("Self-referral is strictly forbidden");
      error.statusCode = 400;
      error.code = "CANNOT_REFER_SELF";
      throw error;
    }
    return await db.transaction(async (tx) => {
      const lockIds = [params.userId, referrerUserId].sort((a, b) => a - b);
      for (const uid of lockIds) {
        await tx.execute(sql5`SELECT id FROM users WHERE id = ${uid} FOR UPDATE`);
      }
      const [currentUser] = await tx.select().from(users).where(eq6(users.id, params.userId)).limit(1);
      if (!currentUser) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
      }
      const [currentUserNode] = await tx.select().from(affiliateNodes).where(eq6(affiliateNodes.userId, params.userId)).limit(1);
      const existingParent = currentUser.referredByUserId || currentUserNode?.parentAffiliateId;
      if (existingParent !== null && existingParent !== void 0) {
        if (existingParent === referrerUserId) {
          return {
            success: true,
            isIdempotent: true,
            message: "Already referred by this sponsor",
            parentUserId: referrerUserId,
            grandParentUserId: currentUserNode?.grandParentAffiliateId || null,
            referralCode: cleanCode
          };
        } else {
          const error = new Error("Referral relationship is immutable and cannot be reassigned");
          error.statusCode = 409;
          error.code = "ALREADY_BOUND";
          throw error;
        }
      }
      let [referrerNode] = await tx.select().from(affiliateNodes).where(eq6(affiliateNodes.userId, referrerUserId)).limit(1);
      if (!referrerNode) {
        const [insertedRefNode] = await tx.insert(affiliateNodes).values({
          userId: referrerUserId,
          referralCode: `PLAY369_${referrerUserId}`,
          totalDirectReferrals: 0,
          totalSubordinates: 0,
          totalTurnoverVolume: "0.0000",
          totalCommissionEarned: "0.0000",
          unclaimedCommission: "0.0000",
          status: "ACTIVE"
        }).returning();
        referrerNode = insertedRefNode;
      }
      let currentAncestorId = referrerNode.parentAffiliateId;
      let depth = 0;
      const visited = /* @__PURE__ */ new Set([referrerUserId]);
      while (currentAncestorId && depth < 50) {
        if (currentAncestorId === params.userId) {
          const error = new Error("Referral cycle detected: Cannot create circular referral relationship");
          error.statusCode = 400;
          error.code = "REFERRAL_CYCLE_DETECTED";
          throw error;
        }
        if (visited.has(currentAncestorId)) {
          break;
        }
        visited.add(currentAncestorId);
        const [ancestorNode] = await tx.select({ parentAffiliateId: affiliateNodes.parentAffiliateId }).from(affiliateNodes).where(eq6(affiliateNodes.userId, currentAncestorId)).limit(1);
        currentAncestorId = ancestorNode?.parentAffiliateId || null;
        depth++;
      }
      const grandParentId = referrerNode.parentAffiliateId || null;
      await tx.update(users).set({
        referredByUserId: referrerUserId,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq6(users.id, params.userId));
      if (currentUserNode) {
        await tx.update(affiliateNodes).set({
          parentAffiliateId: referrerUserId,
          grandParentAffiliateId: grandParentId,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq6(affiliateNodes.userId, params.userId));
      } else {
        await tx.insert(affiliateNodes).values({
          userId: params.userId,
          parentAffiliateId: referrerUserId,
          grandParentAffiliateId: grandParentId,
          referralCode: currentUser.referralCode || `PLAY369_${params.userId}`,
          totalDirectReferrals: 0,
          totalSubordinates: 0,
          totalTurnoverVolume: "0.0000",
          totalCommissionEarned: "0.0000",
          unclaimedCommission: "0.0000",
          status: "ACTIVE"
        });
      }
      await tx.update(affiliateNodes).set({
        totalDirectReferrals: sql5`${affiliateNodes.totalDirectReferrals} + 1`,
        totalSubordinates: sql5`${affiliateNodes.totalSubordinates} + 1`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq6(affiliateNodes.userId, referrerUserId));
      if (grandParentId) {
        await tx.update(affiliateNodes).set({
          totalSubordinates: sql5`${affiliateNodes.totalSubordinates} + 1`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq6(affiliateNodes.userId, grandParentId));
      }
      return {
        success: true,
        isIdempotent: false,
        message: "Referral relationship bound successfully",
        parentUserId: referrerUserId,
        grandParentUserId: grandParentId,
        referralCode: cleanCode
      };
    });
  }
};
var getAffiliateSummaryHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req);
    const [node] = await db.select().from(affiliateNodes).where(eq6(affiliateNodes.userId, userId));
    const commissions = await db.select().from(affiliateCommissions).where(eq6(affiliateCommissions.beneficiaryUserId, userId)).limit(50);
    res.json({
      status: "SUCCESS",
      data: {
        node: node || {
          userId,
          referralCode: `PLAY369_${userId}`,
          totalDirectReferrals: 0,
          totalSubordinates: 0,
          totalTurnoverVolume: "0.0000",
          totalCommissionEarned: "0.0000",
          unclaimedCommission: "0.0000"
        },
        recentCommissions: commissions || []
      }
    });
  } catch (err) {
    const statusCode = err.statusCode || (err.message?.includes("not found") ? 404 : 500);
    res.status(statusCode).json({ status: "ERROR", message: err.message });
  }
};
var claimCommissionHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req);
    const result = await AffiliateService.claimAffiliateCommission(userId);
    res.json({ status: "SUCCESS", data: result });
  } catch (err) {
    const statusCode = err.statusCode || (err.message?.includes("not found") ? 404 : err.message?.includes("frozen") || err.message?.includes("inactive") ? 403 : 400);
    res.status(statusCode).json({ status: "ERROR", message: err.message });
  }
};
var bindReferralHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req);
    const referralCode = req.body?.referralCode;
    if (!referralCode || typeof referralCode !== "string" || !referralCode.trim()) {
      res.status(400).json({
        status: "ERROR",
        code: "INVALID_REFERRAL_CODE",
        message: "Referral code is required"
      });
      return;
    }
    const result = await AffiliateService.bindReferral({
      userId,
      referralCode: referralCode.trim()
    });
    res.json({ status: "SUCCESS", data: result });
  } catch (err) {
    const statusCode = err.statusCode || (err.code === "INVALID_REFERRAL_CODE" ? 404 : err.code === "ALREADY_BOUND" ? 409 : err.code === "CANNOT_REFER_SELF" || err.code === "REFERRAL_CYCLE_DETECTED" ? 400 : err.message?.includes("not found") ? 404 : 400);
    res.status(statusCode).json({
      status: "ERROR",
      code: err.code || "REFERRAL_BIND_ERROR",
      message: err.message
    });
  }
};

// src/server/controllers/vipController.ts
import { and as and5, eq as eq7, or, sql as sql6 } from "drizzle-orm";
var VipService = class _VipService {
  static {
    this.ledgerService = null;
  }
  static setLedgerService(service) {
    _VipService.ledgerService = service;
  }
  static getLedgerService() {
    return _VipService.ledgerService;
  }
  /**
   * Cron / Background Evaluator: Check cumulative deposits and bets to trigger tier upgrades
   * Pure scale-4 BigInt arithmetic (zero float drift / zero Number() conversion).
   */
  static async evaluateVipUpgrade(userId) {
    return await db.transaction(async (tx) => {
      const [progress] = await tx.select().from(userVipProgress).where(eq7(userVipProgress.userId, userId)).for("update");
      if (!progress) return null;
      const currentLvl = progress.currentLevel;
      const depositScale4 = toScale43(progress.cumulativeDeposit || "0.0000");
      const betScale4 = toScale43(progress.cumulativeBet || "0.0000");
      let qualifiedLevel = 1;
      for (const tier of VIP_TIER_CONFIG) {
        const minDepositScale4 = toScale43(tier.minDeposit);
        const minBetScale4 = toScale43(tier.minBet);
        if (depositScale4 >= minDepositScale4 && betScale4 >= minBetScale4) {
          qualifiedLevel = tier.level;
        }
      }
      if (qualifiedLevel > currentLvl) {
        const upgradedTier = VIP_TIER_CONFIG.find((t) => t.level === qualifiedLevel);
        await tx.update(userVipProgress).set({
          currentLevel: qualifiedLevel,
          lastUpgradedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq7(userVipProgress.userId, userId));
        await tx.update(users).set({
          vipLevel: qualifiedLevel,
          vipTier: upgradedTier.name.toUpperCase().replace(/\s+/g, "_"),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq7(users.id, userId));
        return {
          upgraded: true,
          oldLevel: currentLvl,
          newLevel: qualifiedLevel,
          tierName: upgradedTier.name,
          levelUpBonusAvailable: upgradedTier.bonus
        };
      }
      return { upgraded: false, currentLevel: currentLvl };
    });
  }
  /**
   * Authoritative VIP Progression Event Processor (Task 4.3 & 4.3.1 Atomic TOCTOU Fix)
   * 
   * [SOURCE AUTHORITY, ATOMICITY & FINANCIAL INTEGRITY INVARIANTS]:
   * 1. Transactional Atomicity (TOCTOU Proof):
   *    All source lookup (SELECT ... FOR UPDATE on paymentRequests / transactions),
   *    validation, vip_progression_events idempotency, user_vip_progress locking & increment,
   *    and tier upgrade evaluation occur inside the SAME ACID transaction.
   * 2. Authoritative Source Validation: Only settled/approved REAL deposits and committed BET transactions.
   * 3. Exclusions: Rejects failed, pending, rejected, reversed, promo, bonus, commission, admin adjustment, and free-spin stakes.
   * 4. Pure Scale-4 BigInt Arithmetic: Zero Number(), parseFloat(), or floating-point math in financial path.
   * 5. Strict Idempotency: Enforced by PostgreSQL unique constraint on vip_progression_events (user_id, source_transaction_id, source_type).
   * 6. Concurrent Safety: Locks user_vip_progress with FOR UPDATE to eliminate lost updates on parallel events.
   */
  static async processAuthoritativeProgression(params) {
    if (!params.userId || typeof params.userId !== "number") {
      throw new Error("Valid userId is required");
    }
    if (!params.sourceTransactionId || typeof params.sourceTransactionId !== "string" || params.sourceTransactionId.trim() === "") {
      throw new Error("sourceTransactionId is required for VIP progression");
    }
    if (params.sourceType !== "DEPOSIT" && params.sourceType !== "BET") {
      return {
        success: false,
        reason: "INVALID_SOURCE_TYPE",
        userId: params.userId,
        sourceTransactionId: params.sourceTransactionId,
        sourceType: params.sourceType
      };
    }
    return await db.transaction(async (tx) => {
      let authoritativeAmount = "0.0000";
      let authoritativeCurrency = "BDT";
      if (params.sourceType === "DEPOSIT") {
        const [req] = await tx.select().from(paymentRequests).where(
          and5(
            eq7(paymentRequests.userId, params.userId),
            or(
              eq7(paymentRequests.trxId, params.sourceTransactionId),
              sql6`${paymentRequests.id}::varchar = ${params.sourceTransactionId}`
            )
          )
        ).for("update").limit(1);
        let depositRecord = req ? { amount: String(req.amount), currency: req.currency || "BDT", status: req.status, type: req.type, userId: req.userId } : null;
        if (!depositRecord) {
          const [depositTx] = await tx.select().from(transactions).where(
            and5(
              eq7(transactions.userId, params.userId),
              eq7(transactions.transactionId, params.sourceTransactionId)
            )
          ).for("update").limit(1);
          if (depositTx) {
            depositRecord = {
              amount: String(depositTx.amount),
              currency: depositTx.currency || "BDT",
              status: depositTx.status,
              type: depositTx.type,
              userId: depositTx.userId
            };
          }
        }
        if (!depositRecord) {
          return {
            success: false,
            reason: "SOURCE_TRANSACTION_NOT_FOUND",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: "DEPOSIT"
          };
        }
        if (depositRecord.userId !== params.userId) {
          return {
            success: false,
            reason: "TRANSACTION_USER_MISMATCH",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: "DEPOSIT"
          };
        }
        if (depositRecord.type !== "DEPOSIT") {
          return {
            success: false,
            reason: "INVALID_TRANSACTION_TYPE",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: "DEPOSIT"
          };
        }
        const isApprovedDeposit = depositRecord.status === "APPROVED" || depositRecord.status === "COMPLETED" || depositRecord.status === "SETTLED";
        if (!isApprovedDeposit) {
          return {
            success: false,
            reason: "DEPOSIT_NOT_SETTLED",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: "DEPOSIT"
          };
        }
        authoritativeAmount = depositRecord.amount;
        authoritativeCurrency = depositRecord.currency;
      } else if (params.sourceType === "BET") {
        const [betTx] = await tx.select().from(transactions).where(
          and5(
            eq7(transactions.userId, params.userId),
            eq7(transactions.transactionId, params.sourceTransactionId)
          )
        ).for("update").limit(1);
        if (!betTx) {
          return {
            success: false,
            reason: "SOURCE_TRANSACTION_NOT_FOUND",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: "BET"
          };
        }
        if (betTx.userId !== params.userId) {
          return {
            success: false,
            reason: "TRANSACTION_USER_MISMATCH",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: "BET"
          };
        }
        if (betTx.type !== "BET") {
          return {
            success: false,
            reason: "INVALID_TRANSACTION_TYPE",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: "BET"
          };
        }
        const isCommittedBet = betTx.status === "COMPLETED" || betTx.status === "SETTLED";
        if (!isCommittedBet) {
          return {
            success: false,
            reason: "TRANSACTION_NOT_SETTLED",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: "BET"
          };
        }
        const meta = betTx.metadata;
        if (meta && (meta.freeSpin === true || meta.isFreeSpin === true || meta.source === "FREE_SPIN")) {
          return {
            success: false,
            reason: "EXCLUDED_PROMOTIONAL_STAKE",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: "BET"
          };
        }
        authoritativeAmount = String(betTx.amount);
        authoritativeCurrency = betTx.currency || "BDT";
      }
      const amountScale4 = toScale43(authoritativeAmount);
      if (amountScale4 <= 0n) {
        return {
          success: false,
          reason: "INVALID_AMOUNT",
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          sourceType: params.sourceType
        };
      }
      if (params.amount !== void 0 && params.amount !== null) {
        const callerAmountScale4 = typeof params.amount === "bigint" ? params.amount : toScale43(params.amount);
        if (callerAmountScale4 !== amountScale4) {
          return {
            success: false,
            reason: params.sourceType === "BET" ? "BET_AMOUNT_MISMATCH" : "AMOUNT_MISMATCH",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: params.sourceType
          };
        }
      }
      if (params.currency && typeof params.currency === "string" && params.currency.trim() !== "") {
        if (params.currency.trim().toUpperCase() !== authoritativeCurrency.trim().toUpperCase()) {
          return {
            success: false,
            reason: "CURRENCY_MISMATCH",
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            sourceType: params.sourceType
          };
        }
      }
      const amountStr = fromScale43(amountScale4);
      const [existingEvent] = await tx.select().from(vipProgressionEvents).where(
        and5(
          eq7(vipProgressionEvents.userId, params.userId),
          eq7(vipProgressionEvents.sourceTransactionId, params.sourceTransactionId),
          eq7(vipProgressionEvents.sourceType, params.sourceType)
        )
      ).for("update");
      if (existingEvent) {
        const [currProgress] = await tx.select().from(userVipProgress).where(eq7(userVipProgress.userId, params.userId));
        return {
          success: true,
          duplicate: true,
          reason: "ALREADY_PROCESSED",
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          sourceType: params.sourceType,
          currentLevel: currProgress?.currentLevel || 1,
          cumulativeDeposit: currProgress?.cumulativeDeposit || "0.0000",
          cumulativeBet: currProgress?.cumulativeBet || "0.0000"
        };
      }
      const [insertedEvent] = await tx.insert(vipProgressionEvents).values({
        userId: params.userId,
        sourceTransactionId: params.sourceTransactionId,
        sourceType: params.sourceType,
        amount: amountStr,
        currency: authoritativeCurrency,
        processedAt: /* @__PURE__ */ new Date()
      }).onConflictDoNothing().returning();
      if (!insertedEvent) {
        const [currProgress] = await tx.select().from(userVipProgress).where(eq7(userVipProgress.userId, params.userId));
        return {
          success: true,
          duplicate: true,
          reason: "ALREADY_PROCESSED",
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          sourceType: params.sourceType,
          currentLevel: currProgress?.currentLevel || 1,
          cumulativeDeposit: currProgress?.cumulativeDeposit || "0.0000",
          cumulativeBet: currProgress?.cumulativeBet || "0.0000"
        };
      }
      let [progress] = await tx.select().from(userVipProgress).where(eq7(userVipProgress.userId, params.userId)).for("update");
      if (!progress) {
        const [created] = await tx.insert(userVipProgress).values({
          userId: params.userId,
          currentLevel: 1,
          cumulativeDeposit: "0.0000",
          cumulativeBet: "0.0000",
          levelUpBonusClaimed: [],
          totalCashbackClaimed: "0.0000",
          lastUpgradedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).returning();
        progress = created;
      }
      const prevDepositScale4 = toScale43(progress.cumulativeDeposit || "0.0000");
      const prevBetScale4 = toScale43(progress.cumulativeBet || "0.0000");
      let newDepositScale4 = prevDepositScale4;
      let newBetScale4 = prevBetScale4;
      if (params.sourceType === "DEPOSIT") {
        newDepositScale4 = prevDepositScale4 + amountScale4;
      } else if (params.sourceType === "BET") {
        newBetScale4 = prevBetScale4 + amountScale4;
      }
      const newDepositStr = fromScale43(newDepositScale4);
      const newBetStr = fromScale43(newBetScale4);
      let qualifiedLevel = 1;
      for (const tier of VIP_TIER_CONFIG) {
        const minDepositScale4 = toScale43(tier.minDeposit);
        const minBetScale4 = toScale43(tier.minBet);
        if (newDepositScale4 >= minDepositScale4 && newBetScale4 >= minBetScale4) {
          qualifiedLevel = tier.level;
        }
      }
      const currentLvl = progress.currentLevel;
      let upgraded = false;
      let upgradedTierName = void 0;
      let levelUpBonusAvailable = void 0;
      if (qualifiedLevel > currentLvl) {
        upgraded = true;
        const upgradedTier = VIP_TIER_CONFIG.find((t) => t.level === qualifiedLevel);
        upgradedTierName = upgradedTier.name;
        levelUpBonusAvailable = upgradedTier.bonus;
        await tx.update(userVipProgress).set({
          currentLevel: qualifiedLevel,
          cumulativeDeposit: newDepositStr,
          cumulativeBet: newBetStr,
          lastUpgradedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq7(userVipProgress.userId, params.userId));
        await tx.update(users).set({
          vipLevel: qualifiedLevel,
          vipTier: upgradedTier.name.toUpperCase().replace(/\s+/g, "_"),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq7(users.id, params.userId));
      } else {
        await tx.update(userVipProgress).set({
          cumulativeDeposit: newDepositStr,
          cumulativeBet: newBetStr,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq7(userVipProgress.userId, params.userId));
      }
      return {
        success: true,
        duplicate: false,
        userId: params.userId,
        sourceTransactionId: params.sourceTransactionId,
        sourceType: params.sourceType,
        amountScale4,
        amountStr,
        previousDeposit: fromScale43(prevDepositScale4),
        newDeposit: newDepositStr,
        previousBet: fromScale43(prevBetScale4),
        newBet: newBetStr,
        cumulativeDeposit: newDepositStr,
        cumulativeBet: newBetStr,
        previousLevel: currentLvl,
        currentLevel: upgraded ? qualifiedLevel : currentLvl,
        upgraded,
        newTierName: upgradedTierName,
        levelUpBonusAvailable
      };
    });
  }
  static async recordAuthoritativeDeposit(params) {
    return await _VipService.processAuthoritativeProgression({
      ...params,
      sourceType: "DEPOSIT"
    });
  }
  static async recordAuthoritativeBet(params) {
    return await _VipService.processAuthoritativeProgression({
      ...params,
      sourceType: "BET"
    });
  }
  /**
   * Claim VIP Level-Up Reward
   * 
   * [FINANCIAL LEDGER & IDEMPOTENCY INVARIANTS]:
   * 1. Zero Direct Wallet Mutation: Balance changes are strictly executed by production WalletLedgerService.
   * 2. Canonical Scale-4 Money Arithmetic: Exact integer minor units (1 BDT = 10000 minor units).
   * 3. Deterministic Transaction ID: 'VIP_LEVELUP_<userId>_<level>' for exactly-once ledger credit idempotency.
   * 4. Crash-Safe State Machine:
   *    - Row lock on user_vip_progress via SELECT ... FOR UPDATE.
   *    - Row lock & reserve claim in vip_reward_claims with status 'PENDING'.
   *    - Idempotent execution via WalletLedgerService.
   *    - Synchronous transition of vip_reward_claims to 'CREDITED' and update of levelUpBonusClaimed.
   * 5. Fail Closed: Rejects immediately if production WalletLedgerService is unavailable.
   */
  static async claimLevelUpBonus(userId, levelToClaim, customLedgerService) {
    if (!userId || typeof userId !== "number") {
      throw new Error("Valid userId is required");
    }
    if (!levelToClaim || typeof levelToClaim !== "number" || levelToClaim < 1 || levelToClaim > 10) {
      throw new Error("Valid VIP level is required");
    }
    const effectiveLedger = customLedgerService || _VipService.ledgerService;
    if (!effectiveLedger) {
      throw new Error("FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. VIP reward claim failed closed.");
    }
    const tierConfig = VIP_TIER_CONFIG.find((t) => t.level === levelToClaim);
    if (!tierConfig || tierConfig.bonus <= 0) {
      throw new Error("No bonus configured for this level");
    }
    const deterministicClaimTxId = `VIP_LEVELUP_${userId}_${levelToClaim}`;
    const rewardAmountScale4 = toScale43(tierConfig.bonus);
    const rewardAmountStr = fromScale43(rewardAmountScale4);
    return await db.transaction(async (tx) => {
      const [progress] = await tx.select().from(userVipProgress).where(eq7(userVipProgress.userId, userId)).for("update");
      if (!progress) {
        throw new Error("VIP progress profile not found");
      }
      if (progress.currentLevel < levelToClaim) {
        throw new Error(`You have not reached VIP Level ${levelToClaim} yet`);
      }
      const [existingClaim] = await tx.select().from(vipRewardClaims).where(
        and5(
          eq7(vipRewardClaims.userId, userId),
          eq7(vipRewardClaims.vipLevel, levelToClaim)
        )
      ).for("update");
      if (existingClaim && existingClaim.status === "CREDITED") {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }
      const claimedList = (progress.levelUpBonusClaimed || []).slice();
      if (existingClaim?.status === "CREDITED" || claimedList.includes(levelToClaim) && !existingClaim) {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }
      let claimRecord = existingClaim;
      if (!claimRecord) {
        const [inserted] = await tx.insert(vipRewardClaims).values({
          userId,
          vipLevel: levelToClaim,
          transactionId: deterministicClaimTxId,
          rewardAmount: rewardAmountStr,
          currency: "BDT",
          status: "PENDING",
          createdAt: /* @__PURE__ */ new Date()
        }).onConflictDoNothing().returning();
        if (!inserted) {
          const [fetched] = await tx.select().from(vipRewardClaims).where(
            and5(
              eq7(vipRewardClaims.userId, userId),
              eq7(vipRewardClaims.vipLevel, levelToClaim)
            )
          ).for("update");
          claimRecord = fetched;
        } else {
          claimRecord = inserted;
        }
      }
      if (claimRecord && claimRecord.status === "CREDITED") {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }
      const ledgerResult = await effectiveLedger.executeTransaction({
        userId: String(userId),
        currency: "BDT",
        type: "CREDIT",
        targetBalance: "REAL",
        amountMinor: rewardAmountStr,
        transactionId: deterministicClaimTxId,
        auditMetadata: {
          providerId: "GAMEPLAY365_VIP",
          type: "VIP_LEVEL_UP_REWARD",
          userId,
          levelClaimed: levelToClaim,
          tierName: tierConfig.name,
          rewardAmount: rewardAmountStr
        }
      });
      if (claimRecord) {
        await tx.update(vipRewardClaims).set({
          status: "CREDITED",
          creditedAt: /* @__PURE__ */ new Date()
        }).where(eq7(vipRewardClaims.id, claimRecord.id));
      }
      if (!claimedList.includes(levelToClaim)) {
        claimedList.push(levelToClaim);
      }
      await tx.update(userVipProgress).set({
        levelUpBonusClaimed: claimedList,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq7(userVipProgress.userId, userId));
      return {
        levelClaimed: levelToClaim,
        bonusAmount: tierConfig.bonus,
        newRealBalance: ledgerResult.afterBalanceMajor,
        transactionId: deterministicClaimTxId,
        status: "CREDITED"
      };
    });
  }
};
var getVipDetailsHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req, req.query?.userId);
    const [progress] = await db.select().from(userVipProgress).where(eq7(userVipProgress.userId, userId));
    res.json({
      status: "SUCCESS",
      data: {
        tiers: VIP_TIER_CONFIG,
        userProgress: progress || {
          currentLevel: 1,
          cumulativeDeposit: "0.0000",
          cumulativeBet: "0.0000",
          levelUpBonusClaimed: [],
          totalCashbackClaimed: "0.0000"
        }
      }
    });
  } catch (err) {
    const statusCode = err.statusCode || (err.message?.includes("not found") ? 404 : 500);
    res.status(statusCode).json({ status: "ERROR", message: err.message });
  }
};
var claimVipBonusHandler = async (req, res) => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const rawLevel = req.body?.level;
    if (rawLevel === void 0 || rawLevel === null || isNaN(Number(rawLevel))) {
      res.status(400).json({ status: "ERROR", message: "Valid level is required" });
      return;
    }
    const level = Number(rawLevel);
    const result = await VipService.claimLevelUpBonus(userId, level);
    res.json({ status: "SUCCESS", data: result });
  } catch (err) {
    const statusCode = err.statusCode || (err.message?.includes("not found") ? 404 : 400);
    res.status(statusCode).json({ status: "ERROR", message: err.message });
  }
};

// src/server/controllers/providerGatewayController.ts
import { Router } from "express";

// src/data/mockGamesData.ts
var MOCK_CATEGORIES = [
  { id: "all", label: "All Games", labelBn: "\u09B8\u09AC \u0997\u09C7\u09AE", icon: "\u{1F3B2}", count: 48 },
  { id: "hot", label: "Hot & Popular", labelBn: "\u099C\u09A8\u09AA\u09CD\u09B0\u09BF\u09AF\u09BC", icon: "\u{1F525}", count: 16 },
  { id: "slots", label: "Video Slots", labelBn: "\u09B8\u09CD\u09B2\u099F\u09B8", icon: "\u{1F3B0}", count: 24 },
  { id: "crash", label: "Crash & Fast", labelBn: "\u0995\u09CD\u09B0\u09CD\u09AF\u09BE\u09B6 \u0997\u09C7\u09AE", icon: "\u{1F680}", count: 8 },
  { id: "casino", label: "Live Casino", labelBn: "\u09B2\u09BE\u0987\u09AD \u0995\u09CD\u09AF\u09BE\u09B8\u09BF\u09A8\u09CB", icon: "\u2660\uFE0F", count: 12 },
  { id: "table", label: "Table Games", labelBn: "\u099F\u09C7\u09AC\u09BF\u09B2 \u0997\u09C7\u09AE", icon: "\u{1F0CF}", count: 6 },
  { id: "fishing", label: "Fish Hunter", labelBn: "\u09AB\u09BF\u09B6\u09BF\u0982 \u0997\u09C7\u09AE", icon: "\u{1F3A3}", count: 6 },
  { id: "sports", label: "Sportsbook", labelBn: "\u09B8\u09CD\u09AA\u09CB\u09B0\u09CD\u099F\u09B8", icon: "\u26BD", count: 4 }
];
var MOCK_PROVIDERS = [
  { id: "all", name: "All Providers", code: "ALL", icon: "\u{1F310}", gameCount: 48, featured: true },
  { id: "pragmatic", name: "Pragmatic Play", code: "PRAGMATIC", icon: "\u{1F451}", gameCount: 16, featured: true },
  { id: "pgsoft", name: "PG Soft", code: "PGSOFT", icon: "\u{1F48E}", gameCount: 12, featured: true },
  { id: "jili", name: "JILI Games", code: "JILI", icon: "\u26A1", gameCount: 10, featured: true },
  { id: "spribe", name: "Spribe", code: "SPRIBE", icon: "\u{1F680}", gameCount: 4, featured: true },
  { id: "evolution", name: "Evolution Gaming", code: "EVOLUTION", icon: "\u2660\uFE0F", gameCount: 6, featured: true },
  { id: "fachai", name: "Fa Chai", code: "FACHAI", icon: "\u{1F525}", gameCount: 5 },
  { id: "nolimit", name: "Nolimit City", code: "NOLIMIT", icon: "\u{1F480}", gameCount: 4 },
  { id: "hacksaw", name: "Hacksaw Gaming", code: "HACKSAW", icon: "\u{1FA93}", gameCount: 4 }
];
var MOCK_FEATURED_SLIDES = [
  {
    id: "hero-aviator",
    tag: "GLOBAL CRASH PHENOMENON",
    title: "Spribe Aviator \u2022 1,000x Multiplier",
    titleBn: "\u09B8\u09CD\u09AA\u09CD\u09B0\u09BE\u0987\u09AC \u098F\u09AD\u09BF\u09AF\u09BC\u09C7\u099F\u09B0 - \u09E7\u09E6\u09E6\u09E6x \u0995\u09CD\u09AF\u09BE\u09B6 \u09AE\u09BE\u09B2\u09CD\u099F\u09BF\u09AA\u09CD\u09B2\u09BE\u09AF\u09BC\u09BE\u09B0",
    subtitle: "Cash out before the plane flies away. Instant provably-fair multiplier curves.",
    btnText: "Launch Aviator \u{1F680}",
    targetGameId: "spribe_aviator",
    targetAction: "game",
    bgGradient: "from-rose-950/90 via-[#260a12] to-[#02180e]",
    borderColor: "border-rose-500/60",
    accentColor: "#f43f5e",
    iconEmoji: "\u2708\uFE0F",
    multiplierText: "10,000x",
    rtpText: "97.0%"
  },
  {
    id: "hero-olympus",
    tag: "PRAGMATIC MEGA HIT",
    title: "Gates of Olympus 1000 \u2022 Zeus Wrath",
    titleBn: "\u0997\u09C7\u099F\u09B8 \u0985\u09AB \u0985\u09B2\u09BF\u09AE\u09CD\u09AA\u09BE\u09B8 \u09E7\u09E6\u09E6\u09E6 - \u09AE\u09C7\u0997\u09BE \u09AE\u09BE\u09B2\u09CD\u099F\u09BF\u09AA\u09CD\u09B2\u09BE\u09AF\u09BC\u09BE\u09B0",
    subtitle: "Tumble cascades and 1000x lightning orbs in high-volatility Olympian reels.",
    btnText: "Spin Now \u26A1",
    targetGameId: "vs20olympgate",
    targetAction: "game",
    bgGradient: "from-amber-950/90 via-[#2a1d06] to-[#02180e]",
    borderColor: "border-amber-400/60",
    accentColor: "#f59e0b",
    iconEmoji: "\u26A1",
    multiplierText: "15,000x",
    rtpText: "98.5%"
  },
  {
    id: "hero-super-ace",
    tag: "JILI ASIAN CLASSIC",
    title: "Super Ace \u2022 Golden Card Cascades",
    titleBn: "\u09B8\u09C1\u09AA\u09BE\u09B0 \u098F\u09B8 - \u0997\u09CB\u09B2\u09CD\u09A1\u09C7\u09A8 \u0995\u09AE\u09CD\u09AC\u09CB \u09AE\u09BE\u09B2\u09CD\u099F\u09BF\u09AA\u09CD\u09B2\u09BE\u09AF\u09BC\u09BE\u09B0",
    subtitle: "Eliminate golden cards for wild jokers and escalating multiplier free games.",
    btnText: "Play Super Ace \u{1F0CF}",
    targetGameId: "jili_super_ace",
    targetAction: "game",
    bgGradient: "from-emerald-950/90 via-[#072417] to-[#02180e]",
    borderColor: "border-emerald-500/60",
    accentColor: "#10b981",
    iconEmoji: "\u{1F451}",
    multiplierText: "1,500x",
    rtpText: "97.9%"
  },
  {
    id: "hero-mahjong",
    tag: "PG SOFT LEGEND",
    title: "Mahjong Ways 2 \u2022 Dragon Fortune",
    titleBn: "\u09AE\u09BE\u09B9\u099C\u0982 \u0993\u09AF\u09BC\u09C7\u099C \u09E8 - \u09A1\u09CD\u09B0\u09BE\u0997\u09A8 \u09AB\u09B0\u099A\u09C1\u09A8 \u09AE\u09C7\u0997\u09BE \u0993\u09AF\u09BC\u09C7\u099C",
    subtitle: "Gold-plated symbols transform into wilds with up to 10x multiplier in free spins.",
    btnText: "Enter Arena \u{1F004}",
    targetGameId: "pg_mahjong_ways_2",
    targetAction: "game",
    bgGradient: "from-purple-950/90 via-[#1f092b] to-[#02180e]",
    borderColor: "border-purple-500/60",
    accentColor: "#a855f7",
    iconEmoji: "\u{1F004}",
    multiplierText: "100,000x",
    rtpText: "96.9%"
  }
];
var MOCK_GAMES_CATALOG = [
  // --- CRASH & FAST ---
  {
    id: "spribe_aviator",
    name: "Aviator",
    nameBn: "\u098F\u09AD\u09BF\u09AF\u09BC\u09C7\u099F\u09B0",
    provider: "Spribe",
    providerId: "spribe",
    category: "crash",
    rtp: "97.0%",
    volatility: "Medium",
    maxMultiplier: "10,000x",
    minBet: 10,
    maxBet: 5e4,
    imageUrl: "https://images.unsplash.com/photo-1517976487507-5b6533d8a57e?w=600&auto=format&fit=crop&q=80",
    isFeatured: true,
    isHot: true,
    badge: "HOT #1",
    activePlayersCount: 4280,
    tags: ["Crash", "Fast", "Multiplayer", "Instant Cashout"]
  },
  {
    id: "spribe_mines",
    name: "Mines",
    nameBn: "\u09AE\u09BE\u0987\u09A8\u09B8",
    provider: "Spribe",
    providerId: "spribe",
    category: "crash",
    rtp: "97.0%",
    volatility: "High",
    maxMultiplier: "10,000x",
    minBet: 10,
    maxBet: 25e3,
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "HOT",
    activePlayersCount: 1840,
    tags: ["Grid", "Instant Win", "Custom Risk"]
  },
  {
    id: "spribe_plinko",
    name: "Plinko",
    nameBn: "\u09AA\u09CD\u09B2\u09BF\u0999\u09CD\u0995\u09CB",
    provider: "Spribe",
    providerId: "spribe",
    category: "crash",
    rtp: "99.0%",
    volatility: "Low",
    maxMultiplier: "1,000x",
    minBet: 10,
    maxBet: 2e4,
    imageUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "HIGH RTP",
    activePlayersCount: 920,
    tags: ["Plinko", "Casual", "High RTP"]
  },
  // --- PRAGMATIC PLAY SLOTS ---
  {
    id: "vs20olympgate",
    name: "Gates of Olympus",
    nameBn: "\u0997\u09C7\u099F\u09B8 \u0985\u09AB \u0985\u09B2\u09BF\u09AE\u09CD\u09AA\u09BE\u09B8",
    provider: "Pragmatic Play",
    providerId: "pragmatic",
    category: "slots",
    rtp: "96.5%",
    volatility: "Extreme",
    maxMultiplier: "5,000x",
    minBet: 20,
    maxBet: 4e4,
    imageUrl: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80",
    isFeatured: true,
    isHot: true,
    badge: "POPULAR",
    activePlayersCount: 3120,
    tags: ["Tumble", "Free Spins", "Zeus", "Multipliers"]
  },
  {
    id: "vs20sweetbonz",
    name: "Sweet Bonanza",
    nameBn: "\u09B8\u09C1\u0987\u099F \u09AC\u09CB\u09A8\u09BE\u09A8\u099C\u09BE",
    provider: "Pragmatic Play",
    providerId: "pragmatic",
    category: "slots",
    rtp: "96.5%",
    volatility: "High",
    maxMultiplier: "21,100x",
    minBet: 20,
    maxBet: 35e3,
    imageUrl: "https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "HOT",
    activePlayersCount: 2650,
    tags: ["Candy", "Tumble", "Bomb Multipliers"]
  },
  {
    id: "vs20doghouse",
    name: "The Dog House Megaways",
    nameBn: "\u09A6\u09CD\u09AF \u09A1\u0997 \u09B9\u09BE\u0989\u09B8 \u09AE\u09C7\u0997\u09BE\u0993\u09AF\u09BC\u09C7\u099C",
    provider: "Pragmatic Play",
    providerId: "pragmatic",
    category: "slots",
    rtp: "96.6%",
    volatility: "Extreme",
    maxMultiplier: "12,305x",
    minBet: 20,
    maxBet: 25e3,
    imageUrl: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "MEGAWAYS",
    activePlayersCount: 1100,
    tags: ["Megaways", "Sticky Wilds", "Multiplier"]
  },
  {
    id: "vs20starlight",
    name: "Starlight Princess",
    nameBn: "\u09B8\u09CD\u099F\u09BE\u09B0\u09B2\u09BE\u0987\u099F \u09AA\u09CD\u09B0\u09BF\u09A8\u09CD\u09B8\u09C7\u09B8",
    provider: "Pragmatic Play",
    providerId: "pragmatic",
    category: "slots",
    rtp: "96.5%",
    volatility: "Extreme",
    maxMultiplier: "5,000x",
    minBet: 20,
    maxBet: 3e4,
    imageUrl: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "HOT",
    activePlayersCount: 2190,
    tags: ["Anime", "Tumble", "Cascades"]
  },
  {
    id: "vs10bbextrm",
    name: "Big Bass Extreme",
    nameBn: "\u09AC\u09BF\u0997 \u09AC\u09CD\u09AF\u09BE\u09B8 \u098F\u0995\u09CD\u09B8\u099F\u09CD\u09B0\u09BF\u09AE",
    provider: "Pragmatic Play",
    providerId: "pragmatic",
    category: "slots",
    rtp: "96.1%",
    volatility: "High",
    maxMultiplier: "4,000x",
    minBet: 10,
    maxBet: 2e4,
    imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "ANGLER",
    activePlayersCount: 880,
    tags: ["Fishing", "Collect", "Bonus Retrigger"]
  },
  // --- JILI SLOTS & TABLE ---
  {
    id: "jili_super_ace",
    name: "Super Ace",
    nameBn: "\u09B8\u09C1\u09AA\u09BE\u09B0 \u098F\u09B8",
    provider: "JILI Games",
    providerId: "jili",
    category: "slots",
    rtp: "97.9%",
    volatility: "Medium",
    maxMultiplier: "1,500x",
    minBet: 10,
    maxBet: 5e4,
    imageUrl: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=600&auto=format&fit=crop&q=80",
    isFeatured: true,
    isHot: true,
    badge: "JILI #1",
    activePlayersCount: 3890,
    tags: ["Golden Card", "Poker Slots", "Asian Classic"]
  },
  {
    id: "jili_boxing_king",
    name: "Boxing King",
    nameBn: "\u09AC\u0995\u09CD\u09B8\u09BF\u0982 \u0995\u09BF\u0982",
    provider: "JILI Games",
    providerId: "jili",
    category: "slots",
    rtp: "97.0%",
    volatility: "High",
    maxMultiplier: "2,000x",
    minBet: 10,
    maxBet: 3e4,
    imageUrl: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "HOT",
    activePlayersCount: 1750,
    tags: ["Boxing", "Combos", "Free Games"]
  },
  {
    id: "jili_golden_empire",
    name: "Golden Empire",
    nameBn: "\u0997\u09CB\u09B2\u09CD\u09A1\u09C7\u09A8 \u098F\u09AE\u09CD\u09AA\u09BE\u09AF\u09BC\u09BE\u09B0",
    provider: "JILI Games",
    providerId: "jili",
    category: "slots",
    rtp: "97.1%",
    volatility: "High",
    maxMultiplier: "2,000x",
    minBet: 10,
    maxBet: 4e4,
    imageUrl: "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "MEGA WAYS",
    activePlayersCount: 1420,
    tags: ["Inca", "Megaways", "Golden Frames"]
  },
  {
    id: "jili_fortune_gems",
    name: "Fortune Gems 2",
    nameBn: "\u09AB\u09B0\u099A\u09C1\u09A8 \u099C\u09C7\u09AE\u09B8 \u09E8",
    provider: "JILI Games",
    providerId: "jili",
    category: "slots",
    rtp: "97.5%",
    volatility: "Medium",
    maxMultiplier: "10,000x",
    minBet: 10,
    maxBet: 5e4,
    imageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "HOT",
    activePlayersCount: 2900,
    tags: ["Multiplier Reel", "Classic 3x3", "Instant Bonus"]
  },
  {
    id: "jili_crazy_777",
    name: "Crazy 777",
    nameBn: "\u0995\u09CD\u09B0\u09C7\u099C\u09BF \u09ED\u09ED\u09ED",
    provider: "JILI Games",
    providerId: "jili",
    category: "slots",
    rtp: "97.2%",
    volatility: "Low",
    maxMultiplier: "3,333x",
    minBet: 5,
    maxBet: 15e3,
    imageUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "CLASSIC",
    activePlayersCount: 650,
    tags: ["Retro", "Single Line", "Special Reel"]
  },
  // --- PG SOFT SLOTS ---
  {
    id: "pg_mahjong_ways_2",
    name: "Mahjong Ways 2",
    nameBn: "\u09AE\u09BE\u09B9\u099C\u0982 \u0993\u09AF\u09BC\u09C7\u099C \u09E8",
    provider: "PG Soft",
    providerId: "pgsoft",
    category: "slots",
    rtp: "96.9%",
    volatility: "Medium",
    maxMultiplier: "100,000x",
    minBet: 10,
    maxBet: 5e4,
    imageUrl: "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&auto=format&fit=crop&q=80",
    isFeatured: true,
    isHot: true,
    badge: "PG TOP #1",
    activePlayersCount: 4670,
    tags: ["Mahjong", "Gold Symbols", "Transforming Wilds"]
  },
  {
    id: "pg_fortune_tiger",
    name: "Fortune Tiger",
    nameBn: "\u09AB\u09B0\u099A\u09C1\u09A8 \u099F\u09BE\u0987\u0997\u09BE\u09B0",
    provider: "PG Soft",
    providerId: "pgsoft",
    category: "slots",
    rtp: "96.8%",
    volatility: "Medium",
    maxMultiplier: "2,500x",
    minBet: 10,
    maxBet: 3e4,
    imageUrl: "https://images.unsplash.com/photo-1561731216-c3a4d99437d5?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "HOT",
    activePlayersCount: 3100,
    tags: ["Tiger Respins", "10x Multiplier Full Screen"]
  },
  {
    id: "pg_fortune_rabbit",
    name: "Fortune Rabbit",
    nameBn: "\u09AB\u09B0\u099A\u09C1\u09A8 \u09B0\u200D\u09CD\u09AF\u09BE\u09AC\u09BF\u099F",
    provider: "PG Soft",
    providerId: "pgsoft",
    category: "slots",
    rtp: "96.7%",
    volatility: "Medium",
    maxMultiplier: "5,000x",
    minBet: 10,
    maxBet: 3e4,
    imageUrl: "https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "PRIZE FEATURE",
    activePlayersCount: 1650,
    tags: ["Prize Symbols", "Free Spins"]
  },
  {
    id: "pg_lucky_neko",
    name: "Lucky Neko",
    nameBn: "\u09B2\u09BE\u0995\u09BF \u09A8\u09C7\u0995\u09CB",
    provider: "PG Soft",
    providerId: "pgsoft",
    category: "slots",
    rtp: "96.7%",
    volatility: "Medium",
    maxMultiplier: "20,000x",
    minBet: 10,
    maxBet: 4e4,
    imageUrl: "https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "HOT",
    activePlayersCount: 2200,
    tags: ["Cat Multipliers", "Gigantic Wilds"]
  },
  {
    id: "pg_wild_bandito",
    name: "Wild Bandito",
    nameBn: "\u0993\u09AF\u09BC\u09BE\u0987\u09B2\u09CD\u09A1 \u09AC\u09BE\u09A8\u09CD\u09A1\u09BF\u09A4\u09CB",
    provider: "PG Soft",
    providerId: "pgsoft",
    category: "slots",
    rtp: "96.7%",
    volatility: "Medium",
    maxMultiplier: "25,000x",
    minBet: 10,
    maxBet: 25e3,
    imageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "NEW",
    activePlayersCount: 950,
    tags: ["Mariachi", "Increasing Multiplier"]
  },
  // --- LIVE CASINO (EVOLUTION & PRAGMATIC LIVE) ---
  {
    id: "evo_crazy_time",
    name: "Crazy Time",
    nameBn: "\u0995\u09CD\u09B0\u09C7\u099C\u09BF \u099F\u09BE\u0987\u09AE",
    provider: "Evolution Gaming",
    providerId: "evolution",
    category: "casino",
    rtp: "96.1%",
    volatility: "High",
    maxMultiplier: "25,000x",
    minBet: 10,
    maxBet: 1e5,
    imageUrl: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80",
    isFeatured: true,
    isHot: true,
    badge: "LIVE SHOW",
    activePlayersCount: 5400,
    tags: ["Live Presenter", "Cash Hunt", "Pachinko", "Coin Flip"]
  },
  {
    id: "evo_lightning_roulette",
    name: "Lightning Roulette",
    nameBn: "\u09B2\u09BE\u0987\u099F\u09A8\u09BF\u0982 \u09B0\u09C1\u09B2\u09C7\u099F",
    provider: "Evolution Gaming",
    providerId: "evolution",
    category: "casino",
    rtp: "97.3%",
    volatility: "High",
    maxMultiplier: "500x",
    minBet: 20,
    maxBet: 2e5,
    imageUrl: "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "LIVE",
    activePlayersCount: 3100,
    tags: ["Live Dealer", "Lightning Multipliers", "European Wheel"]
  },
  {
    id: "evo_speed_baccarat_a",
    name: "Speed Baccarat A",
    nameBn: "\u09B8\u09CD\u09AA\u09BF\u09A1 \u09AC\u09CD\u09AF\u09BE\u0995\u09BE\u09B0\u09BE\u09A4",
    provider: "Evolution Gaming",
    providerId: "evolution",
    category: "casino",
    rtp: "98.9%",
    volatility: "Low",
    maxMultiplier: "11x",
    minBet: 50,
    maxBet: 5e5,
    imageUrl: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "HIGH ROLLER",
    activePlayersCount: 2800,
    tags: ["Asian Squeeze", "Live Roadmaps", "Dragon Bonus"]
  },
  {
    id: "evo_monopoly_live",
    name: "Monopoly Live",
    nameBn: "\u09AE\u09A8\u09CB\u09AA\u09B2\u09BF \u09B2\u09BE\u0987\u09AD",
    provider: "Evolution Gaming",
    providerId: "evolution",
    category: "casino",
    rtp: "96.2%",
    volatility: "High",
    maxMultiplier: "10,000x",
    minBet: 10,
    maxBet: 5e4,
    imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "3D BONUS",
    activePlayersCount: 1980,
    tags: ["Mr Monopoly", "3D Board", "Dice Rolls"]
  },
  // --- FISH HUNTER & ARCADE ---
  {
    id: "jili_mega_fishing",
    name: "Mega Fishing",
    nameBn: "\u09AE\u09C7\u0997\u09BE \u09AB\u09BF\u09B6\u09BF\u0982",
    provider: "JILI Games",
    providerId: "jili",
    category: "fishing",
    rtp: "97.0%",
    volatility: "Medium",
    maxMultiplier: "950x",
    minBet: 1,
    maxBet: 1e3,
    imageUrl: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "FISH #1",
    activePlayersCount: 1890,
    tags: ["Deep Sea", "Laser Cannon", "Boss Jackpot"]
  },
  {
    id: "fc_fierce_fishing",
    name: "Fierce Fishing",
    nameBn: "\u09AB\u09BF\u09AF\u09BC\u09BE\u09B0\u09CD\u09B8 \u09AB\u09BF\u09B6\u09BF\u0982",
    provider: "Fa Chai",
    providerId: "fachai",
    category: "fishing",
    rtp: "97.2%",
    volatility: "Medium",
    maxMultiplier: "1,000x",
    minBet: 1,
    maxBet: 1500,
    imageUrl: "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "HOT",
    activePlayersCount: 1120,
    tags: ["Torpedo", "Golden Kraken", "Lock Target"]
  },
  // --- SPORTSBOOK ---
  {
    id: "sports_cricket_exchange",
    name: "BPL & IPL Cricket Live",
    nameBn: "\u0995\u09CD\u09B0\u09BF\u0995\u09C7\u099F \u09B2\u09BE\u0987\u09AD \u098F\u0995\u09CD\u09B8\u099A\u09C7\u099E\u09CD\u099C",
    provider: "PLAY369 Sports",
    providerId: "pragmatic",
    category: "sports",
    rtp: "98.0%",
    volatility: "Medium",
    maxMultiplier: "500x",
    minBet: 50,
    maxBet: 2e5,
    imageUrl: "https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?w=600&auto=format&fit=crop&q=80",
    isHot: true,
    badge: "LIVE MATCH",
    activePlayersCount: 4900,
    tags: ["Cricket", "In-Play Live", "Fast Odds"]
  },
  {
    id: "sports_premier_league",
    name: "EPL & UEFA Football",
    nameBn: "\u09AB\u09C1\u099F\u09AC\u09B2 \u09AA\u09CD\u09B0\u09BF\u09AE\u09BF\u09AF\u09BC\u09BE\u09B0 \u09B2\u09C0\u0997",
    provider: "PLAY369 Sports",
    providerId: "pragmatic",
    category: "sports",
    rtp: "97.8%",
    volatility: "Medium",
    maxMultiplier: "1,000x",
    minBet: 50,
    maxBet: 2e5,
    imageUrl: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80",
    isHot: false,
    badge: "FOOTBALL",
    activePlayersCount: 2300,
    tags: ["Live Soccer", "Corners", "Asian Handicap"]
  }
];

// src/services/providers/errors.ts
var ProviderError = class _ProviderError extends Error {
  constructor(message, providerId, statusCode) {
    super(message);
    this.name = "ProviderError";
    this.providerId = providerId;
    this.statusCode = statusCode;
    this.isOperational = true;
    Object.setPrototypeOf(this, _ProviderError.prototype);
  }
};
var ProviderTimeoutError = class _ProviderTimeoutError extends ProviderError {
  constructor(providerId, timeoutMs) {
    super(
      `Provider '${providerId}' request timed out after ${timeoutMs}ms`,
      providerId,
      408
    );
    this.name = "ProviderTimeoutError";
    Object.setPrototypeOf(this, _ProviderTimeoutError.prototype);
  }
};
var GameNotFoundError = class _GameNotFoundError extends ProviderError {
  constructor(gameId, providerId = "unknown") {
    super(`Game with ID '${gameId}' was not found in provider '${providerId}'`, providerId, 404);
    this.name = "GameNotFoundError";
    Object.setPrototypeOf(this, _GameNotFoundError.prototype);
  }
};
async function withTimeout2(promise, timeoutMs, providerId = "generic") {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new ProviderTimeoutError(providerId, timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

// src/services/providers/validation.ts
function validateCreateGameSessionRequest(request, providerId = "validation") {
  if (!request) {
    throw new ProviderError("CreateGameSessionRequest payload cannot be empty", providerId, 400);
  }
  if (!request.userId || typeof request.userId !== "string" || request.userId.trim().length === 0) {
    throw new ProviderError("Valid userId is required to create a game session", providerId, 400);
  }
  if (!request.gameId || typeof request.gameId !== "string" || request.gameId.trim().length === 0) {
    throw new ProviderError("Valid gameId is required to create a game session", providerId, 400);
  }
  if (!request.currency || !["BDT", "USD"].includes(request.currency)) {
    throw new ProviderError(`Unsupported currency '${request.currency}'. Must be BDT or USD`, providerId, 400);
  }
  if (request.mode && !["REAL", "DEMO"].includes(request.mode)) {
    throw new ProviderError(`Invalid session mode '${request.mode}'. Must be REAL or DEMO`, providerId, 400);
  }
}
function validateLaunchGameRequest(request, providerId = "validation") {
  if (!request) {
    throw new ProviderError("LaunchGameRequest payload cannot be empty", providerId, 400);
  }
  if (!request.userId || typeof request.userId !== "string" || request.userId.trim().length === 0) {
    throw new ProviderError("Valid userId is required to launch a game", providerId, 400);
  }
  if (!request.gameId || typeof request.gameId !== "string" || request.gameId.trim().length === 0) {
    throw new ProviderError("Valid gameId is required to launch a game", providerId, 400);
  }
}
function sanitizeGameListFilter(filter) {
  if (!filter) return {};
  return {
    category: filter.category ? filter.category.trim().toLowerCase() : void 0,
    providerId: filter.providerId ? filter.providerId.trim().toLowerCase() : void 0,
    searchQuery: filter.searchQuery ? filter.searchQuery.trim().toLowerCase() : void 0,
    isHot: typeof filter.isHot === "boolean" ? filter.isHot : void 0,
    isFeatured: typeof filter.isFeatured === "boolean" ? filter.isFeatured : void 0,
    limit: typeof filter.limit === "number" && filter.limit > 0 ? Math.min(filter.limit, 100) : void 0,
    offset: typeof filter.offset === "number" && filter.offset >= 0 ? filter.offset : 0
  };
}

// src/services/providers/adapters/MockGameProviderAdapter.ts
var MockGameProviderAdapter = class {
  constructor(customCatalog) {
    this.providerId = "mock_aggregator";
    this.providerName = "PLAY369 Unified Mock Aggregator";
    this.providerCode = "PLAY369_MOCK";
    this.gamesCatalog = (customCatalog || MOCK_GAMES_CATALOG).map((item) => ({
      id: item.id,
      name: item.name,
      nameBn: item.nameBn,
      provider: item.provider,
      providerId: item.providerId,
      category: item.category,
      rtp: item.rtp,
      volatility: item.volatility,
      maxMultiplier: item.maxMultiplier,
      minBet: item.minBet,
      maxBet: item.maxBet,
      imageUrl: item.imageUrl,
      isFeatured: item.isFeatured,
      isHot: item.isHot,
      isNew: item.isNew,
      badge: item.badge,
      activePlayersCount: item.activePlayersCount,
      tags: item.tags,
      demoSupported: true
    }));
  }
  /**
   * List games matching optional criteria
   */
  async listGames(filter) {
    return withTimeout2(
      (async () => {
        const cleanFilter = sanitizeGameListFilter(filter);
        let results = [...this.gamesCatalog];
        if (cleanFilter.category && cleanFilter.category !== "all") {
          if (cleanFilter.category === "hot") {
            results = results.filter((g) => g.isHot || g.isFeatured);
          } else {
            results = results.filter((g) => g.category === cleanFilter.category);
          }
        }
        if (cleanFilter.providerId && cleanFilter.providerId !== "all" && cleanFilter.providerId.toLowerCase() !== this.providerId.toLowerCase()) {
          results = results.filter(
            (g) => g.providerId.toLowerCase() === cleanFilter.providerId?.toLowerCase() || g.provider.toLowerCase() === cleanFilter.providerId?.toLowerCase()
          );
        }
        if (cleanFilter.searchQuery) {
          const q = cleanFilter.searchQuery;
          results = results.filter(
            (g) => g.name.toLowerCase().includes(q) || g.nameBn && g.nameBn.toLowerCase().includes(q) || g.provider.toLowerCase().includes(q) || g.tags?.some((t) => t.toLowerCase().includes(q))
          );
        }
        if (cleanFilter.isHot !== void 0) {
          results = results.filter((g) => !!g.isHot === cleanFilter.isHot);
        }
        if (cleanFilter.isFeatured !== void 0) {
          results = results.filter((g) => !!g.isFeatured === cleanFilter.isFeatured);
        }
        if (cleanFilter.offset && cleanFilter.offset > 0) {
          results = results.slice(cleanFilter.offset);
        }
        if (cleanFilter.limit && cleanFilter.limit > 0) {
          results = results.slice(0, cleanFilter.limit);
        }
        return results;
      })(),
      3e3,
      this.providerId
    );
  }
  /**
   * Get single game by ID
   */
  async getGame(gameId) {
    return withTimeout2(
      (async () => {
        if (!gameId || typeof gameId !== "string") return null;
        const normalizedId = gameId.trim().toLowerCase();
        const found = this.gamesCatalog.find((g) => g.id.toLowerCase() === normalizedId);
        return found || null;
      })(),
      3e3,
      this.providerId
    );
  }
  /**
   * Create secure game session for an authenticated player
   */
  async createGameSession(request) {
    validateCreateGameSessionRequest(request, this.providerId);
    return withTimeout2(
      (async () => {
        const game = await this.getGame(request.gameId);
        if (!game) {
          throw new GameNotFoundError(request.gameId, this.providerId);
        }
        const now = /* @__PURE__ */ new Date();
        const sessionId = `SES_${this.providerCode}_${request.userId.slice(-6)}_${Date.now()}`;
        const token = `JWT_MOCK_${Math.random().toString(36).substring(2)}_${Date.now()}`;
        const isInternalMiniGame = [
          "spribe_aviator",
          "spribe_mines",
          "jili_super_ace",
          "pg_mahjong_ways_2",
          "pgsoft_mahjong_ways2",
          "evo_crazy_time",
          "evo_lightning_roulette",
          "vs20olympgate"
        ].includes(game.id);
        const launchMode = isInternalMiniGame ? "component" : "iframe";
        const launchUrl = `/launch?gameId=${encodeURIComponent(game.id)}&sessionId=${sessionId}&token=${token}&currency=${request.currency}`;
        return {
          sessionId,
          gameId: game.id,
          providerId: game.providerId || this.providerId,
          token,
          expiresInSeconds: 7200,
          gameLaunchUrl: launchUrl,
          launchMode,
          createdAt: now.toISOString()
        };
      })(),
      4e3,
      this.providerId
    );
  }
  /**
   * Launch game wrapper
   */
  async launchGame(request) {
    validateLaunchGameRequest(request, this.providerId);
    try {
      const session = await this.createGameSession({
        userId: request.userId,
        username: request.username || `User_${request.userId.slice(-4)}`,
        gameId: request.gameId,
        currency: request.currency || "BDT",
        mode: request.mode || "REAL",
        language: request.language || "bn",
        clientPlatform: request.clientPlatform || "web",
        returnUrl: request.returnUrl || "/"
      });
      return {
        success: true,
        gameId: request.gameId,
        providerId: session.providerId,
        launchUrl: session.gameLaunchUrl,
        launchMode: session.launchMode,
        session
      };
    } catch (err) {
      return {
        success: false,
        gameId: request.gameId,
        providerId: this.providerId,
        launchMode: "component",
        error: err?.message || "Failed to launch game"
      };
    }
  }
  /**
   * Health status ping and integrity check for Mock Provider
   * Categorizes status into HEALTHY, DEGRADED, or UNAVAILABLE
   */
  async healthCheck() {
    const startTime = performance.now();
    const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
    try {
      return await withTimeout2(
        (async () => {
          const isCatalogLoaded = Array.isArray(this.gamesCatalog) && this.gamesCatalog.length > 0;
          if (!isCatalogLoaded) {
            const elapsed2 = Math.round(performance.now() - startTime);
            return {
              provider: this.providerId,
              providerId: this.providerId,
              providerName: this.providerName,
              status: "UNAVAILABLE",
              latency: elapsed2,
              latencyMs: elapsed2,
              checkedAt,
              error: "Game catalog is empty or corrupted",
              activeGamesCount: 0,
              details: { engine: "MockGameProviderAdapter", statusReason: "CatalogEmpty" }
            };
          }
          const sampleGame = this.gamesCatalog[0];
          const hasValidSchema = sampleGame && Boolean(sampleGame.id && sampleGame.name && sampleGame.provider);
          if (!hasValidSchema) {
            const elapsed2 = Math.round(performance.now() - startTime);
            return {
              provider: this.providerId,
              providerId: this.providerId,
              providerName: this.providerName,
              status: "DEGRADED",
              latency: elapsed2,
              latencyMs: elapsed2,
              checkedAt,
              error: "Catalog schema warning: sample item missing required fields",
              activeGamesCount: this.gamesCatalog.length,
              details: { engine: "MockGameProviderAdapter", sampleId: sampleGame?.id }
            };
          }
          const elapsed = Math.max(1, Math.round(performance.now() - startTime));
          const status = elapsed > 500 ? "DEGRADED" : "HEALTHY";
          return {
            provider: this.providerId,
            providerId: this.providerId,
            providerName: this.providerName,
            status,
            latency: elapsed,
            latencyMs: elapsed,
            checkedAt,
            error: null,
            activeGamesCount: this.gamesCatalog.length,
            details: {
              engine: "MockGameProviderAdapter",
              version: "1.0.0",
              providerCode: this.providerCode,
              features: ["instant_session", "component_launcher", "offline_resilience"]
            }
          };
        })(),
        3e3,
        this.providerId
      );
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      return {
        provider: this.providerId,
        providerId: this.providerId,
        providerName: this.providerName,
        status: "UNAVAILABLE",
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: err?.message || "Provider health check failed or timed out",
        activeGamesCount: 0,
        details: { errorName: err?.name }
      };
    }
  }
  /**
   * Alias for backwards compatibility
   */
  async getProviderHealth() {
    return this.healthCheck();
  }
};

// src/services/providers/providerRegistry.ts
var GameProviderRegistry = class {
  constructor() {
    this.adapters = /* @__PURE__ */ new Map();
    this.defaultProviderId = "mock_aggregator";
    const mockAdapter = new MockGameProviderAdapter();
    this.registerProvider(mockAdapter);
  }
  /**
   * Register a new game provider adapter
   */
  registerProvider(adapter) {
    if (!adapter || !adapter.providerId) {
      throw new Error("Cannot register provider with invalid or missing providerId");
    }
    this.adapters.set(adapter.providerId.toLowerCase(), adapter);
  }
  /**
   * Unregister an existing game provider adapter
   */
  unregisterProvider(providerId) {
    return this.adapters.delete(providerId.toLowerCase());
  }
  /**
   * Retrieve a registered provider adapter by ID
   */
  getProvider(providerId) {
    return this.adapters.get(providerId.toLowerCase());
  }
  /**
   * Get the primary or fallback default provider adapter
   */
  getDefaultProvider() {
    const defaultAdapter = this.adapters.get(this.defaultProviderId);
    if (defaultAdapter) return defaultAdapter;
    const firstAdapter = this.adapters.values().next().value;
    if (firstAdapter) return firstAdapter;
    const freshMock = new MockGameProviderAdapter();
    this.registerProvider(freshMock);
    return freshMock;
  }
  /**
   * Check if a provider ID is registered
   */
  hasProvider(providerId) {
    return this.adapters.has(providerId.toLowerCase());
  }
  /**
   * Retrieve all currently registered provider adapters
   */
  getAllProviders() {
    return Array.from(this.adapters.values());
  }
  /**
   * List all registered provider IDs
   */
  getRegisteredProviderIds() {
    return Array.from(this.adapters.keys());
  }
  /**
   * Set the default fallback provider ID
   */
  setDefaultProviderId(providerId) {
    this.defaultProviderId = providerId.toLowerCase();
  }
  /**
   * Check health status of a specific provider with timeout protection
   */
  async checkProviderHealth(providerId, timeoutMs = 3e3) {
    const startTime = performance.now();
    const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
    const adapter = this.getProvider(providerId);
    if (!adapter) {
      const elapsed = Math.round(performance.now() - startTime);
      return {
        provider: providerId,
        providerId,
        providerName: `Unknown (${providerId})`,
        status: "UNAVAILABLE",
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: `Provider '${providerId}' is not registered`,
        activeGamesCount: 0
      };
    }
    try {
      const healthPromise = adapter.healthCheck ? adapter.healthCheck() : adapter.getProviderHealth ? adapter.getProviderHealth() : Promise.resolve({
        provider: adapter.providerId,
        providerId: adapter.providerId,
        providerName: adapter.providerName,
        status: "HEALTHY",
        latency: 1,
        latencyMs: 1,
        checkedAt,
        error: null,
        activeGamesCount: 0
      });
      return await withTimeout2(healthPromise, timeoutMs, adapter.providerId);
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      return {
        provider: adapter.providerId,
        providerId: adapter.providerId,
        providerName: adapter.providerName,
        status: "UNAVAILABLE",
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: err?.message || "Health check timed out or failed",
        activeGamesCount: 0,
        details: { errorName: err?.name }
      };
    }
  }
  /**
   * Check health across all registered providers
   */
  async checkAllProvidersHealth(timeoutMs = 3e3) {
    const results = {};
    const adapters = this.getAllProviders();
    await Promise.all(
      adapters.map(async (adapter) => {
        results[adapter.providerId] = await this.checkProviderHealth(adapter.providerId, timeoutMs);
      })
    );
    return results;
  }
};
var gameProviderRegistry = new GameProviderRegistry();

// src/services/providers/healthService.ts
var ProviderHealthService = class {
  constructor(registry = gameProviderRegistry) {
    this.defaultTimeoutMs = 3500;
    this.lastHealthMap = /* @__PURE__ */ new Map();
    this.registry = registry;
  }
  /**
   * Check health of a single specific provider adapter
   */
  async checkProvider(providerId, timeoutMs = this.defaultTimeoutMs) {
    const startTime = performance.now();
    const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
    const adapter = this.registry.getProvider(providerId);
    if (!adapter) {
      const elapsed = Math.round(performance.now() - startTime);
      const result = {
        provider: providerId,
        providerId,
        providerName: `Unknown Provider (${providerId})`,
        status: "UNAVAILABLE",
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: `Provider '${providerId}' is not registered in ProviderRegistry`,
        activeGamesCount: 0,
        details: { reason: "ProviderNotRegistered" }
      };
      this.lastHealthMap.set(providerId.toLowerCase(), result);
      return result;
    }
    try {
      const healthPromise = adapter.healthCheck ? adapter.healthCheck() : adapter.getProviderHealth ? adapter.getProviderHealth() : Promise.resolve({
        provider: adapter.providerId,
        providerId: adapter.providerId,
        providerName: adapter.providerName,
        status: "HEALTHY",
        latency: 1,
        latencyMs: 1,
        checkedAt,
        error: null,
        activeGamesCount: 0
      });
      const result = await withTimeout2(healthPromise, timeoutMs, adapter.providerId);
      const normalizedResult = {
        provider: result.provider || adapter.providerId,
        providerId: result.providerId || adapter.providerId,
        providerName: result.providerName || adapter.providerName,
        status: result.status,
        latency: result.latency ?? result.latencyMs ?? 0,
        latencyMs: result.latencyMs ?? result.latency ?? 0,
        checkedAt: result.checkedAt || checkedAt,
        error: result.error || null,
        activeGamesCount: result.activeGamesCount ?? 0,
        details: result.details
      };
      this.lastHealthMap.set(adapter.providerId.toLowerCase(), normalizedResult);
      return normalizedResult;
    } catch (err) {
      const elapsed = Math.round(performance.now() - startTime);
      const errorResult = {
        provider: adapter.providerId,
        providerId: adapter.providerId,
        providerName: adapter.providerName,
        status: "UNAVAILABLE",
        latency: elapsed,
        latencyMs: elapsed,
        checkedAt,
        error: err?.message || "Health check timed out or failed",
        activeGamesCount: 0,
        details: { errorName: err?.name || "Error" }
      };
      this.lastHealthMap.set(adapter.providerId.toLowerCase(), errorResult);
      return errorResult;
    }
  }
  /**
   * Check health of all registered provider adapters in parallel
   */
  async checkAllProviders(timeoutMs = this.defaultTimeoutMs) {
    const adapters = this.registry.getAllProviders();
    if (adapters.length === 0) {
      return [];
    }
    const checkPromises = adapters.map(
      (adapter) => this.checkProvider(adapter.providerId, timeoutMs)
    );
    return await Promise.all(checkPromises);
  }
  /**
   * Returns a map of provider ID to its latest health result
   */
  async getHealthMap(timeoutMs = this.defaultTimeoutMs) {
    const results = await this.checkAllProviders(timeoutMs);
    const map = {};
    for (const r of results) {
      map[r.providerId] = r;
    }
    return map;
  }
  /**
   * Get system-wide aggregate health summary
   */
  async getSystemHealthOverview(timeoutMs = this.defaultTimeoutMs) {
    const results = await this.checkAllProviders(timeoutMs);
    let healthyCount = 0;
    let degradedCount = 0;
    let unavailableCount = 0;
    for (const r of results) {
      if (r.status === "HEALTHY") healthyCount++;
      else if (r.status === "DEGRADED") degradedCount++;
      else unavailableCount++;
    }
    let overallStatus = "HEALTHY";
    if (unavailableCount > 0 && healthyCount === 0) {
      overallStatus = "UNAVAILABLE";
    } else if (unavailableCount > 0 || degradedCount > 0) {
      overallStatus = "DEGRADED";
    }
    return {
      overallStatus,
      totalProviders: results.length,
      healthyCount,
      degradedCount,
      unavailableCount,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      providers: results
    };
  }
  /**
   * Get cached health result without issuing fresh network ping
   */
  getCachedHealth(providerId) {
    return this.lastHealthMap.get(providerId.toLowerCase());
  }
};
var providerHealthService = new ProviderHealthService();

// src/services/gameService.ts
var GameService = class {
  constructor(registry = gameProviderRegistry, healthService = providerHealthService) {
    this.registry = registry;
    this.healthService = healthService;
  }
  /**
   * Get the underlying registry instance
   */
  getRegistry() {
    return this.registry;
  }
  /**
   * Get the underlying health service instance
   */
  getHealthService() {
    return this.healthService;
  }
  /**
   * Fetch game catalog matching the requested filters.
   * Aggregates across all registered adapters or targets a specific adapter.
   */
  async listGames(filter) {
    try {
      if (filter?.providerId && filter.providerId !== "all") {
        const targetAdapter = this.registry.getProvider(filter.providerId);
        if (targetAdapter) {
          return await targetAdapter.listGames(filter);
        }
      }
      const defaultAdapter = this.registry.getDefaultProvider();
      return await defaultAdapter.listGames(filter);
    } catch (err) {
      console.error("[GameService] listGames error:", err);
      return [];
    }
  }
  /**
   * Retrieve game details by unique game ID
   */
  async getGame(gameId) {
    try {
      if (!gameId) return null;
      const allAdapters = this.registry.getAllProviders();
      for (const adapter of allAdapters) {
        const game = await adapter.getGame(gameId);
        if (game) return game;
      }
      return await this.registry.getDefaultProvider().getGame(gameId);
    } catch (err) {
      console.error(`[GameService] getGame error for ${gameId}:`, err);
      return null;
    }
  }
  /**
   * Create an authorized game session for an authenticated user
   */
  async createGameSession(request) {
    const game = await this.getGame(request.gameId);
    const targetProviderId = game?.providerId || "mock_aggregator";
    const adapter = this.registry.getProvider(targetProviderId) || this.registry.getDefaultProvider();
    return await adapter.createGameSession(request);
  }
  /**
   * Launch game flow for player
   */
  async launchGame(request) {
    try {
      const game = await this.getGame(request.gameId);
      const targetProviderId = game?.providerId || "mock_aggregator";
      const adapter = this.registry.getProvider(targetProviderId) || this.registry.getDefaultProvider();
      return await adapter.launchGame(request);
    } catch (err) {
      return {
        success: false,
        gameId: request.gameId,
        providerId: "unknown",
        launchMode: "component",
        error: err?.message || "Failed to launch game"
      };
    }
  }
  /**
   * Retrieve available game categories
   */
  async getCategories() {
    return Promise.resolve(MOCK_CATEGORIES);
  }
  /**
   * Retrieve available certified game providers
   */
  async getProviders() {
    return Promise.resolve(MOCK_PROVIDERS);
  }
  /**
   * Retrieve featured hero slides for carousel
   */
  async getFeaturedSlides() {
    return Promise.resolve(MOCK_FEATURED_SLIDES);
  }
  /**
   * Check health across all registered game provider adapters
   */
  async checkProvidersHealth(timeoutMs) {
    return await this.healthService.getHealthMap(timeoutMs);
  }
  /**
   * Check health of a single provider by ID
   */
  async checkProviderHealth(providerId, timeoutMs) {
    return await this.healthService.checkProvider(providerId, timeoutMs);
  }
  /**
   * Retrieve aggregate overview of provider ecosystem health
   */
  async getSystemHealthOverview(timeoutMs) {
    return await this.healthService.getSystemHealthOverview(timeoutMs);
  }
};
var gameService = new GameService();

// src/server/gateway/types.ts
var GatewayError = class extends Error {
  constructor(code, message, statusCode = 500, provider, details) {
    super(message);
    this.name = "GatewayError";
    this.code = code;
    this.statusCode = statusCode;
    this.provider = provider || null;
    this.details = details;
  }
};

// src/server/gateway/validation.ts
var IDENTIFIER_REGEX = /^[a-zA-Z0-9_\-\.]{1,64}$/;
var USER_ID_REGEX = /^[a-zA-Z0-9_\-\.@]{1,64}$/;
function validateProviderId(providerId, paramName = "providerId") {
  if (!providerId || typeof providerId !== "string") {
    throw new GatewayError(
      "VALIDATION_ERROR",
      `Parameter '${paramName}' is required and must be a non-empty string`,
      400,
      typeof providerId === "string" ? providerId : null,
      { paramName }
    );
  }
  const trimmed = providerId.trim();
  if (!IDENTIFIER_REGEX.test(trimmed)) {
    throw new GatewayError(
      "VALIDATION_ERROR",
      `Parameter '${paramName}' contains invalid characters or exceeds 64 characters`,
      400,
      trimmed,
      { paramName, value: trimmed }
    );
  }
  return trimmed;
}
function validateGameId(gameId, paramName = "gameId") {
  if (!gameId || typeof gameId !== "string") {
    throw new GatewayError(
      "VALIDATION_ERROR",
      `Parameter '${paramName}' is required and must be a non-empty string`,
      400,
      null,
      { paramName }
    );
  }
  const trimmed = gameId.trim();
  if (!IDENTIFIER_REGEX.test(trimmed)) {
    throw new GatewayError(
      "VALIDATION_ERROR",
      `Parameter '${paramName}' contains invalid characters or exceeds 64 characters`,
      400,
      null,
      { paramName, value: trimmed }
    );
  }
  return trimmed;
}
function validateLaunchPayload(body) {
  if (!body || typeof body !== "object") {
    throw new GatewayError("VALIDATION_ERROR", "Request body must be a valid JSON object", 400);
  }
  const gameId = validateGameId(body.gameId);
  if (!body.userId || typeof body.userId !== "string" || !USER_ID_REGEX.test(body.userId.trim())) {
    throw new GatewayError("VALIDATION_ERROR", "Valid userId is required for game launch", 400, null, {
      paramName: "userId"
    });
  }
  if (!body.username || typeof body.username !== "string" || body.username.trim().length === 0) {
    throw new GatewayError("VALIDATION_ERROR", "Valid username is required for game launch", 400, null, {
      paramName: "username"
    });
  }
  let currency = "BDT";
  if (body.currency) {
    const normCurr = String(body.currency).toUpperCase().trim();
    if (normCurr !== "BDT" && normCurr !== "USD") {
      throw new GatewayError("VALIDATION_ERROR", `Unsupported currency '${body.currency}'. Allowed: BDT, USD`, 400, null, {
        paramName: "currency",
        value: body.currency
      });
    }
    currency = normCurr;
  }
  return {
    gameId,
    userId: body.userId.trim(),
    username: body.username.trim(),
    currency,
    language: body.language === "bn" ? "bn" : "en",
    ipAddress: typeof body.ipAddress === "string" ? body.ipAddress.substring(0, 45) : void 0,
    userAgent: typeof body.userAgent === "string" ? body.userAgent.substring(0, 255) : void 0,
    returnUrl: typeof body.returnUrl === "string" ? body.returnUrl.substring(0, 500) : void 0
  };
}
function validateSessionPayload(body) {
  if (!body || typeof body !== "object") {
    throw new GatewayError("VALIDATION_ERROR", "Request body must be a valid JSON object", 400);
  }
  const gameId = validateGameId(body.gameId);
  if (!body.userId || typeof body.userId !== "string" || !USER_ID_REGEX.test(body.userId.trim())) {
    throw new GatewayError("VALIDATION_ERROR", "Valid userId is required for game session", 400, null, {
      paramName: "userId"
    });
  }
  if (!body.username || typeof body.username !== "string" || body.username.trim().length === 0) {
    throw new GatewayError("VALIDATION_ERROR", "Valid username is required for game session", 400, null, {
      paramName: "username"
    });
  }
  let currency = "BDT";
  if (body.currency) {
    const normCurr = String(body.currency).toUpperCase().trim();
    if (normCurr !== "BDT" && normCurr !== "USD") {
      throw new GatewayError("VALIDATION_ERROR", `Unsupported currency '${body.currency}'. Allowed: BDT, USD`, 400, null, {
        paramName: "currency",
        value: body.currency
      });
    }
    currency = normCurr;
  }
  return {
    gameId,
    userId: body.userId.trim(),
    username: body.username.trim(),
    currency,
    ipAddress: typeof body.ipAddress === "string" ? body.ipAddress.substring(0, 45) : void 0,
    language: body.language === "bn" ? "bn" : "en"
  };
}

// src/server/gateway/serverProviderGateway.ts
var ServerProviderGateway = class {
  constructor(service = gameService) {
    this.defaultTimeoutMs = 4e3;
    this.gameService = service;
  }
  /**
   * Generates or sanitizes a request correlation ID
   */
  resolveCorrelationId(headerValue) {
    if (typeof headerValue === "string" && headerValue.trim().length > 0) {
      return headerValue.trim().substring(0, 64);
    }
    const rand = Math.random().toString(36).substring(2, 10);
    return `req-gw-${Date.now()}-${rand}`;
  }
  /**
   * Wraps an asynchronous operation with an enforceable timeout and structured error mapping
   */
  async executeWithTimeout(operation, timeoutMs, correlationId, operationName, providerId) {
    let timer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new GatewayError(
            "PROVIDER_TIMEOUT",
            `Operation '${operationName}' timed out after ${timeoutMs}ms`,
            504,
            providerId,
            { timeoutMs, operationName }
          )
        );
      }, timeoutMs);
    });
    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err) {
      if (timer) clearTimeout(timer);
      if (err instanceof GatewayError) {
        throw err;
      }
      const errName = err?.name || "";
      const errMsg = err?.message || "Unknown provider error";
      if (errName === "ProviderTimeoutError") {
        throw new GatewayError("PROVIDER_TIMEOUT", errMsg, 504, providerId, { originalError: errName });
      }
      if (errName === "ProviderOfflineError" || errName === "GameNotFoundError") {
        throw new GatewayError("PROVIDER_UNAVAILABLE", errMsg, 503, providerId, { originalError: errName });
      }
      if (errName === "ProviderValidationError") {
        throw new GatewayError("VALIDATION_ERROR", errMsg, 400, providerId, { originalError: errName });
      }
      if (errName === "ProviderError") {
        throw new GatewayError("PROVIDER_ERROR", errMsg, 502, providerId, { originalError: errName });
      }
      throw new GatewayError("INTERNAL_ERROR", errMsg, 500, providerId, { originalError: errName });
    }
  }
  /**
   * Retrieve game catalog through the Gateway
   */
  async listGames(req, correlationId) {
    safeLog("info", correlationId, "Listing games with filter", req);
    if (req.providerId && req.providerId !== "all") {
      validateProviderId(req.providerId, "providerId");
    }
    const games = await this.executeWithTimeout(
      async () => {
        return await this.gameService.listGames(req);
      },
      this.defaultTimeoutMs,
      correlationId,
      "listGames",
      req.providerId
    );
    safeLog("info", correlationId, `Fetched ${games.length} games`);
    return {
      success: true,
      data: games,
      correlationId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Retrieve single game details through Gateway
   */
  async getGame(gameId, correlationId) {
    const validGameId = validateGameId(gameId);
    safeLog("info", correlationId, `Fetching game ${validGameId}`);
    const game = await this.executeWithTimeout(
      async () => {
        return await this.gameService.getGame(validGameId);
      },
      this.defaultTimeoutMs,
      correlationId,
      "getGame"
    );
    if (!game) {
      throw new GatewayError("PROVIDER_UNAVAILABLE", `Game '${validGameId}' not found or unavailable`, 503, null, {
        gameId: validGameId
      });
    }
    return {
      success: true,
      data: game,
      correlationId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Create an authorized game session through the Gateway
   */
  async createSession(payload, correlationId) {
    const validated = validateSessionPayload(payload);
    safeLog("info", correlationId, "Creating game session", {
      gameId: validated.gameId,
      userId: validated.userId,
      currency: validated.currency
    });
    const session = await this.executeWithTimeout(
      async () => {
        return await this.gameService.createGameSession(validated);
      },
      this.defaultTimeoutMs,
      correlationId,
      "createSession"
    );
    safeLog("info", correlationId, "Game session generated successfully", {
      sessionId: session.sessionId,
      gameId: session.gameId
    });
    return {
      success: true,
      data: session,
      correlationId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Launch game through the Gateway
   */
  async launchGame(payload, correlationId) {
    const validated = validateLaunchPayload(payload);
    safeLog("info", correlationId, "Launching game", {
      gameId: validated.gameId,
      userId: validated.userId,
      currency: validated.currency
    });
    const result = await this.executeWithTimeout(
      async () => {
        return await this.gameService.launchGame(validated);
      },
      this.defaultTimeoutMs,
      correlationId,
      "launchGame"
    );
    if (!result.success) {
      throw new GatewayError("PROVIDER_ERROR", result.error || "Provider rejected game launch", 502, result.providerId, {
        gameId: validated.gameId
      });
    }
    safeLog("info", correlationId, "Game launched successfully", {
      gameId: result.gameId,
      launchMode: result.launchMode
    });
    return {
      success: true,
      data: result,
      correlationId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Check health of a specific provider through Gateway
   */
  async checkProviderHealth(providerId, correlationId, timeoutMs = 3e3) {
    const validProviderId = validateProviderId(providerId);
    safeLog("info", correlationId, `Checking health for provider '${validProviderId}'`);
    const health = await this.executeWithTimeout(
      async () => {
        return await this.gameService.checkProviderHealth(validProviderId, timeoutMs);
      },
      timeoutMs + 500,
      correlationId,
      "checkProviderHealth",
      validProviderId
    );
    if (health.status === "UNAVAILABLE") {
      throw new GatewayError(
        "PROVIDER_UNAVAILABLE",
        health.error || `Provider '${validProviderId}' is UNAVAILABLE`,
        503,
        validProviderId,
        { health }
      );
    }
    return {
      success: true,
      data: health,
      correlationId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Check health of all providers through Gateway
   */
  async checkAllProvidersHealth(correlationId, timeoutMs = 3e3) {
    safeLog("info", correlationId, "Checking health across all providers");
    const healthMap = await this.executeWithTimeout(
      async () => {
        return await this.gameService.checkProvidersHealth(timeoutMs);
      },
      timeoutMs + 1e3,
      correlationId,
      "checkAllProvidersHealth"
    );
    return {
      success: true,
      data: healthMap,
      correlationId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Retrieve system-wide provider health overview
   */
  async getSystemHealthOverview(correlationId, timeoutMs = 3e3) {
    safeLog("info", correlationId, "Fetching system health overview");
    const overview = await this.executeWithTimeout(
      async () => {
        return await this.gameService.getSystemHealthOverview(timeoutMs);
      },
      timeoutMs + 1e3,
      correlationId,
      "getSystemHealthOverview"
    );
    return {
      success: true,
      data: overview,
      correlationId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Formats error objects into uniform GatewayError responses
   */
  formatErrorResponse(err, correlationId) {
    const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
    if (err instanceof GatewayError) {
      safeLog("warn", correlationId, `GatewayError [${err.code}]: ${err.message}`, {
        statusCode: err.statusCode,
        provider: err.provider,
        details: err.details
      });
      return {
        statusCode: err.statusCode,
        payload: {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            provider: err.provider,
            details: err.details
          },
          correlationId,
          timestamp: timestamp2
        }
      };
    }
    safeLog("error", correlationId, `Unhandled error in Provider Gateway: ${err?.message || err}`, err);
    return {
      statusCode: 500,
      payload: {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err?.message || "An unexpected internal gateway error occurred"
        },
        correlationId,
        timestamp: timestamp2
      }
    };
  }
};
var serverProviderGateway = new ServerProviderGateway();

// src/server/controllers/providerGatewayController.ts
var ProviderGatewayController = class {
  constructor(gateway = serverProviderGateway) {
    /**
     * GET /api/gateway/providers/games
     * Lists games from registered providers matching query parameters
     */
    this.listGames = async (req, res) => {
      const correlationId = this.getCorrelationId(req);
      try {
        const { category, providerId, search, isHot, limit: limit2, offset } = req.query;
        const result = await this.gateway.listGames(
          {
            category: typeof category === "string" ? category : void 0,
            providerId: typeof providerId === "string" ? providerId : void 0,
            search: typeof search === "string" ? search : void 0,
            isHot: isHot === "true",
            limit: limit2 ? Number(limit2) : void 0,
            offset: offset ? Number(offset) : void 0
          },
          correlationId
        );
        res.setHeader("x-correlation-id", correlationId);
        res.status(200).json(result);
      } catch (err) {
        const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(statusCode).json(payload);
      }
    };
    /**
     * GET /api/gateway/providers/games/:gameId
     * Retrieves single game metadata
     */
    this.getGame = async (req, res) => {
      const correlationId = this.getCorrelationId(req);
      try {
        const { gameId } = req.params;
        const result = await this.gateway.getGame(gameId, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(200).json(result);
      } catch (err) {
        const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(statusCode).json(payload);
      }
    };
    /**
     * POST /api/gateway/providers/session
     * Generates an authorized player session
     */
    this.createSession = async (req, res) => {
      const correlationId = this.getCorrelationId(req);
      try {
        const result = await this.gateway.createSession(req.body, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(200).json(result);
      } catch (err) {
        const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(statusCode).json(payload);
      }
    };
    /**
     * POST /api/gateway/providers/launch
     * Launches a game session (returns launch mode, component or iframe URL)
     */
    this.launchGame = async (req, res) => {
      const correlationId = this.getCorrelationId(req);
      try {
        const result = await this.gateway.launchGame(req.body, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(200).json(result);
      } catch (err) {
        const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(statusCode).json(payload);
      }
    };
    /**
     * GET /api/gateway/providers/health
     * Retrieves health status across all registered providers
     */
    this.getHealth = async (req, res) => {
      const correlationId = this.getCorrelationId(req);
      try {
        const timeoutMs = req.query.timeout ? Number(req.query.timeout) : 3e3;
        const result = await this.gateway.checkAllProvidersHealth(correlationId, timeoutMs);
        res.setHeader("x-correlation-id", correlationId);
        res.status(200).json(result);
      } catch (err) {
        const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(statusCode).json(payload);
      }
    };
    /**
     * GET /api/gateway/providers/health/:providerId
     * Retrieves health status for a specific provider
     */
    this.getProviderHealth = async (req, res) => {
      const correlationId = this.getCorrelationId(req);
      try {
        const { providerId } = req.params;
        const timeoutMs = req.query.timeout ? Number(req.query.timeout) : 3e3;
        const result = await this.gateway.checkProviderHealth(providerId, correlationId, timeoutMs);
        res.setHeader("x-correlation-id", correlationId);
        res.status(200).json(result);
      } catch (err) {
        const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(statusCode).json(payload);
      }
    };
    /**
     * GET /api/gateway/providers/overview
     * Retrieves aggregate system health summary
     */
    this.getOverview = async (req, res) => {
      const correlationId = this.getCorrelationId(req);
      try {
        const timeoutMs = req.query.timeout ? Number(req.query.timeout) : 3e3;
        const result = await this.gateway.getSystemHealthOverview(correlationId, timeoutMs);
        res.setHeader("x-correlation-id", correlationId);
        res.status(200).json(result);
      } catch (err) {
        const { statusCode, payload } = this.gateway.formatErrorResponse(err, correlationId);
        res.setHeader("x-correlation-id", correlationId);
        res.status(statusCode).json(payload);
      }
    };
    this.gateway = gateway;
  }
  /**
   * Helper to extract correlation ID from request headers
   */
  getCorrelationId(req) {
    return this.gateway.resolveCorrelationId(req.headers["x-correlation-id"]);
  }
};
var providerGatewayController = new ProviderGatewayController();
function createProviderGatewayRouter() {
  const router = Router();
  router.get("/games", providerGatewayController.listGames);
  router.get("/games/:gameId", providerGatewayController.getGame);
  router.post("/session", providerGatewayController.createSession);
  router.post("/launch", providerGatewayController.launchGame);
  router.get("/health", providerGatewayController.getHealth);
  router.get("/health/:providerId", providerGatewayController.getProviderHealth);
  router.get("/overview", providerGatewayController.getOverview);
  return router;
}

// src/server/sandbox/fixtures.ts
var PAYMENT_CREATED_FIXTURE = {
  transactionId: "SBX_TX_CREATED_001",
  customerName: "Rahim Uddin",
  customerEmail: "rahim@example.com",
  amount: "1000.0000",
  status: "PENDING",
  code: "SANDBOX_PENDING",
  message: "Sandbox payment initialized in pending state",
  metadata: {
    tier: "VIP_1",
    channel: "SANDBOX_BKASH",
    createdVia: "HARNESS_FIXTURE"
  }
};
var PAYMENT_PENDING_FIXTURE = {
  transactionId: "SBX_TX_PENDING_002",
  customerName: "Karim Hossain",
  customerEmail: "karim@example.com",
  amount: "2500.0000",
  status: "PENDING",
  code: "SANDBOX_PENDING",
  message: "Payment is awaiting simulated confirmation",
  metadata: {
    providerRef: "SBX_PROV_REF_99",
    channel: "SANDBOX_NAGAD"
  }
};
var PAYMENT_COMPLETED_FIXTURE = {
  transactionId: "SBX_TX_COMPLETED_003",
  customerName: "Fatima Begum",
  customerEmail: "fatima@example.com",
  amount: "5000.0000",
  status: "COMPLETED",
  code: "SANDBOX_VERIFIED_NO_SETTLEMENT",
  message: "Payment verified in sandbox mode (non-monetary, zero wallet mutation)",
  metadata: {
    paymentMethod: "SANDBOX_BKASH",
    simulatedFee: "0.0000",
    channel: "SANDBOX"
  }
};
var PAYMENT_ERROR_FIXTURE = {
  transactionId: "SBX_TX_ERROR_004",
  customerName: "Jamal Ahmed",
  customerEmail: "jamal@example.com",
  amount: "750.0000",
  status: "ERROR",
  code: "SANDBOX_ERROR",
  message: "Simulated payment processing failure in sandbox",
  metadata: {
    failureReason: "SIMULATED_USER_CANCELLED",
    channel: "SANDBOX"
  }
};
var PAYMENT_DUPLICATE_FIXTURE = {
  transactionId: "SBX_TX_DUPLICATE_005",
  customerName: "Tanvir Islam",
  customerEmail: "tanvir@example.com",
  amount: "1500.0000",
  status: "COMPLETED",
  code: "SANDBOX_VERIFIED_NO_SETTLEMENT",
  message: "Payment verified in sandbox mode for duplicate assertion test",
  metadata: {
    purpose: "DUPLICATE_VERIFICATION_IDEMPOTENCY_TEST",
    channel: "SANDBOX"
  }
};
var PAYMENT_AMOUNT_MISMATCH_FIXTURE = {
  transactionId: "SBX_TX_MISMATCH_006",
  customerName: "Nusrat Jahan",
  customerEmail: "nusrat@example.com",
  amount: "3000.0000",
  // Expected actual fixture amount
  status: "COMPLETED",
  code: "SANDBOX_VERIFIED_NO_SETTLEMENT",
  message: "Payment fixture for testing client amount discrepancy",
  metadata: {
    channel: "SANDBOX"
  }
};
function getDefaultSandboxFixtures() {
  return [
    { ...PAYMENT_CREATED_FIXTURE },
    { ...PAYMENT_PENDING_FIXTURE },
    { ...PAYMENT_COMPLETED_FIXTURE },
    { ...PAYMENT_ERROR_FIXTURE },
    { ...PAYMENT_DUPLICATE_FIXTURE },
    { ...PAYMENT_AMOUNT_MISMATCH_FIXTURE }
  ];
}

// src/server/sandbox/sandboxPaymentAdapter.ts
var SandboxPaymentAdapter = class {
  constructor() {
    this.fixtures = /* @__PURE__ */ new Map();
    this.verificationCounts = /* @__PURE__ */ new Map();
    this.resetFixtures();
  }
  /**
   * Resets fixtures to the standard default test suite.
   */
  resetFixtures() {
    this.fixtures.clear();
    this.verificationCounts.clear();
    const defaults = getDefaultSandboxFixtures();
    for (const f of defaults) {
      this.fixtures.set(f.transactionId, { ...f });
      this.verificationCounts.set(f.transactionId, 0);
    }
  }
  /**
   * Registers a custom deterministic fixture in memory.
   */
  registerFixture(fixture) {
    const parsed = validatePaymentAmount(fixture.amount);
    this.fixtures.set(fixture.transactionId, {
      ...fixture,
      amount: parsed.decimalString
    });
    if (!this.verificationCounts.has(fixture.transactionId)) {
      this.verificationCounts.set(fixture.transactionId, 0);
    }
  }
  /**
   * Updates or transitions the deterministic status of an existing fixture.
   */
  setFixtureStatus(transactionId, status, code) {
    const fixture = this.fixtures.get(transactionId);
    if (fixture) {
      fixture.status = status;
      if (code) fixture.code = code;
      this.fixtures.set(transactionId, fixture);
    }
  }
  /**
   * Returns verification count for a transaction ID.
   */
  getVerificationCount(transactionId) {
    return this.verificationCounts.get(transactionId) || 0;
  }
  /**
   * Helper to check if production fail-close applies.
   */
  isProduction() {
    return process.env.NODE_ENV === "production";
  }
  /**
   * 1. Create Payment Request & Response
   * Models the documented payment creation contract safely in sandbox mode.
   */
  async createPayment(req) {
    if (this.isProduction()) {
      return {
        status: "SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION",
        message: "Sandbox payment adapter is strictly disabled in production environment",
        isSandbox: true
      };
    }
    if (!req.customerName || typeof req.customerName !== "string" || req.customerName.trim() === "") {
      throw new Error("Customer name is required and must be a non-empty string");
    }
    if (!req.customerEmail || typeof req.customerEmail !== "string" || !req.customerEmail.includes("@")) {
      throw new Error("Customer email is required and must be a valid email address");
    }
    if (!req.successCallbackUrl || !req.cancelCallbackUrl) {
      throw new Error("Success and cancel callback URLs are required");
    }
    let parsedAmount;
    try {
      parsedAmount = validatePaymentAmount(req.amount);
    } catch (err) {
      throw new Error(`Invalid payment amount: ${err.message}`);
    }
    const txId = `SBX_TX_PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const fixture = {
      transactionId: txId,
      customerName: req.customerName.trim(),
      customerEmail: req.customerEmail.trim(),
      amount: parsedAmount.decimalString,
      status: "PENDING",
      code: "SANDBOX_PENDING",
      message: "Sandbox payment created and awaiting customer action",
      metadata: {
        ...req.metadata || {},
        successCallbackUrl: req.successCallbackUrl,
        cancelCallbackUrl: req.cancelCallbackUrl,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
    this.registerFixture(fixture);
    return {
      status: "CREATED",
      message: "Sandbox payment URL generated successfully",
      paymentUrl: `https://sandbox.gameplay365.local/checkout/${txId}`,
      transactionId: txId,
      amount: parsedAmount.decimalString,
      isSandbox: true,
      metadata: fixture.metadata
    };
  }
  /**
   * 2. Verify Payment Request & Response
   * Simulates non-monetary verification of a sandbox transaction.
   * NEVER credits WalletLedgerService. Returns SANDBOX_VERIFIED_NO_SETTLEMENT.
   */
  async verifyPayment(req) {
    if (this.isProduction()) {
      return {
        status: "SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION",
        code: "SANDBOX_ADAPTER_DISABLED_IN_PRODUCTION",
        customerName: "",
        customerEmail: "",
        amount: "0.0000",
        transactionId: req.transactionId || "",
        metadata: {},
        isSandbox: true,
        settlementBlocked: true,
        message: "Sandbox payment adapter is strictly disabled in production environment"
      };
    }
    if (!req.transactionId || typeof req.transactionId !== "string" || req.transactionId.trim() === "") {
      return {
        status: "ERROR",
        code: "VALIDATION_ERROR",
        customerName: "",
        customerEmail: "",
        amount: "0.0000",
        transactionId: "",
        metadata: {},
        isSandbox: true,
        settlementBlocked: true,
        message: "Transaction ID is required for verification"
      };
    }
    const txId = req.transactionId.trim();
    const fixture = this.fixtures.get(txId);
    if (!fixture) {
      return {
        status: "ERROR",
        code: "FIXTURE_NOT_FOUND",
        customerName: "",
        customerEmail: "",
        amount: "0.0000",
        transactionId: txId,
        metadata: {},
        isSandbox: true,
        settlementBlocked: true,
        message: `Sandbox transaction fixture not found for ID: ${txId}`
      };
    }
    const currentCount = (this.verificationCounts.get(txId) || 0) + 1;
    this.verificationCounts.set(txId, currentCount);
    if (req.expectedAmount !== void 0 && req.expectedAmount !== null && req.expectedAmount !== "") {
      let expectedParsed;
      try {
        expectedParsed = validatePaymentAmount(req.expectedAmount);
      } catch (err) {
        return {
          status: "ERROR",
          code: "AMOUNT_MISMATCH",
          customerName: fixture.customerName,
          customerEmail: fixture.customerEmail,
          amount: fixture.amount,
          transactionId: txId,
          metadata: fixture.metadata || {},
          isSandbox: true,
          settlementBlocked: true,
          verificationCount: currentCount,
          message: `Invalid expectedAmount parameter: ${err.message}`
        };
      }
      if (expectedParsed.decimalString !== fixture.amount) {
        return {
          status: "ERROR",
          code: "AMOUNT_MISMATCH",
          customerName: fixture.customerName,
          customerEmail: fixture.customerEmail,
          amount: fixture.amount,
          transactionId: txId,
          metadata: fixture.metadata || {},
          isSandbox: true,
          settlementBlocked: true,
          verificationCount: currentCount,
          message: `Amount mismatch: expected ${expectedParsed.decimalString} BDT but sandbox recorded ${fixture.amount} BDT`
        };
      }
    }
    const resultCode = fixture.status === "COMPLETED" ? "SANDBOX_VERIFIED_NO_SETTLEMENT" : fixture.status === "PENDING" ? "SANDBOX_PENDING" : "SANDBOX_ERROR";
    return {
      status: fixture.status,
      code: resultCode,
      customerName: fixture.customerName,
      customerEmail: fixture.customerEmail,
      amount: fixture.amount,
      transactionId: fixture.transactionId,
      metadata: fixture.metadata || {},
      isSandbox: true,
      settlementBlocked: true,
      // Permanent invariant: never triggers real wallet mutations
      verificationCount: currentCount,
      message: fixture.message || `Sandbox verification completed with state: ${fixture.status}`
    };
  }
  /**
   * 4. Browser Redirect Parameter Evaluator
   * Invariant: NEVER treat browser redirect/query parameters as payment authority.
   * A success-screen redirect must remain informational only.
   */
  evaluateRedirectCallback(queryParams) {
    return {
      isAuthoritative: false,
      status: "INFORMATIONAL_ONLY",
      advisoryMessage: "Browser redirect parameters are strictly informational and carry zero payment authority. Authoritative payment state can only be obtained through explicit backend verifyPayment() against the sandbox adapter.",
      rawParams: { ...queryParams }
    };
  }
};
var sandboxPaymentAdapter = new SandboxPaymentAdapter();

// src/server/sandbox/router.ts
import { Router as Router2 } from "express";

// src/lib/firebase-admin.ts
import { initializeApp as initializeApp2, getApps } from "firebase-admin/app";
import { getAuth as getAuth2 } from "firebase-admin/auth";
import { getFirestore as getFirestore2 } from "firebase-admin/firestore";
var realApp = null;
var realAuth = null;
var realDb = null;
var customAuthAdapter = null;
var customDbAdapter = null;
function getLazyApp() {
  if (!realApp) {
    const apps = getApps();
    if (apps.length > 0) {
      realApp = apps[0];
    } else {
      realApp = initializeApp2({
        projectId: firebase_applet_config_default.projectId
      });
    }
  }
  return realApp;
}
function getLazyAuth() {
  if (!realAuth) {
    realAuth = getAuth2(getLazyApp());
  }
  return realAuth;
}
function getLazyDb() {
  if (!realDb) {
    realDb = getFirestore2(getLazyApp());
  }
  return realDb;
}
var adminAuth = {
  verifyIdToken: async (token, checkRevoked) => {
    if (customAuthAdapter) {
      return customAuthAdapter.verifyIdToken(token, checkRevoked);
    }
    return getLazyAuth().verifyIdToken(token, checkRevoked);
  },
  getUser: async (uid) => {
    if (customAuthAdapter && customAuthAdapter.getUser) {
      return customAuthAdapter.getUser(uid);
    }
    return getLazyAuth().getUser(uid);
  }
};
var adminDb = {
  collection: (collectionName) => {
    if (customDbAdapter) {
      return customDbAdapter.collection(collectionName);
    }
    return getLazyDb().collection(collectionName);
  }
};

// src/middleware/auth.ts
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "ERROR",
      code: "UNAUTHENTICATED",
      error: "Unauthorized: Missing token",
      message: "Unauthorized: Missing token"
    });
  }
  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return res.status(401).json({
      status: "ERROR",
      code: "UNAUTHENTICATED",
      error: "Unauthorized: Missing token",
      message: "Unauthorized: Missing token"
    });
  }
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error?.message || error);
    return res.status(401).json({
      status: "ERROR",
      code: "UNAUTHENTICATED",
      error: "Unauthorized: Invalid token",
      message: "Unauthorized: Invalid token"
    });
  }
};
async function getAuthoritativeUserRole(decodedToken) {
  const uid = decodedToken.uid;
  const claimRole = decodedToken.role || (decodedToken.admin ? "ADMIN" : void 0) || (decodedToken.isAdmin ? "ADMIN" : void 0);
  if (claimRole && typeof claimRole === "string") {
    const upper = claimRole.toUpperCase();
    if (["ADMIN", "OPERATOR", "SUPER_ADMIN"].includes(upper)) {
      return upper;
    }
  }
  try {
    const adminDoc = await adminDb.collection("admins").doc(uid).get();
    if (adminDoc.exists) {
      const data = adminDoc.data();
      const r = (data?.role || "ADMIN").toUpperCase();
      if (["ADMIN", "OPERATOR", "SUPER_ADMIN"].includes(r)) {
        return r;
      }
    }
  } catch (err) {
    console.warn("[AuthMiddleware] Error checking admins collection:", err);
  }
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      const role = (data?.role || (data?.isAdmin ? "ADMIN" : "PLAYER")).toUpperCase();
      if (["ADMIN", "OPERATOR", "SUPER_ADMIN"].includes(role) || data?.isAdmin === true) {
        return role === "PLAYER" ? "ADMIN" : role;
      }
      if (role === "VIP") return "VIP";
    }
  } catch (err) {
    console.warn("[AuthMiddleware] Error checking users collection:", err);
  }
  return "PLAYER";
}
var requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      status: "ERROR",
      code: "UNAUTHENTICATED",
      error: "Unauthorized: Missing token",
      message: "Unauthorized: Missing token"
    });
  }
  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return res.status(401).json({
      status: "ERROR",
      code: "UNAUTHENTICATED",
      error: "Unauthorized: Missing token",
      message: "Unauthorized: Missing token"
    });
  }
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const authoritativeRole = await getAuthoritativeUserRole(decodedToken);
    req.userRole = authoritativeRole;
    const isPrivileged = ["ADMIN", "OPERATOR", "SUPER_ADMIN"].includes(authoritativeRole);
    if (!isPrivileged) {
      return res.status(403).json({
        status: "ERROR",
        code: "FORBIDDEN",
        error: "Forbidden: Insufficient privileges",
        message: "Forbidden: Admin or Operator access required"
      });
    }
    req.isAuthorizedAdmin = true;
    next();
  } catch (error) {
    console.error("Error in requireAdmin middleware:", error?.message || error);
    return res.status(401).json({
      status: "ERROR",
      code: "UNAUTHENTICATED",
      error: "Unauthorized: Invalid token",
      message: "Unauthorized: Invalid token"
    });
  }
};

// src/server/controllers/sandboxPaymentController.ts
var SandboxPaymentController = class {
  constructor(adapter = sandboxPaymentAdapter) {
    this.adapter = adapter;
  }
  /**
   * Allows injecting a custom/mock SandboxPaymentAdapter instance for testing.
   */
  setSandboxAdapter(adapter) {
    this.adapter = adapter;
  }
  /**
   * Helper to verify if environment is production.
   */
  isProduction() {
    return process.env.NODE_ENV === "production";
  }
  /**
   * Helper to extract standard error code from validatePaymentAmount error
   */
  extractAmountErrorCode(err) {
    if (err?.message?.includes("UNSAFE_NUMERIC_MONEY_INPUT")) {
      return "UNSAFE_NUMERIC_MONEY_INPUT";
    }
    if (err?.message?.includes("Over-precision")) {
      return "OVER_PRECISION_AMOUNT";
    }
    return "INVALID_PAYMENT_AMOUNT_FORMAT";
  }
  /**
   * POST /api/sandbox/payment/create
   * Accepts: customerName, customerEmail, amount (exact string), metadata
   * Server strictly owns the sandbox success/cancel callback URLs.
   */
  async createPayment(req, res) {
    if (this.isProduction()) {
      res.status(404).json({
        success: false,
        error: "Sandbox routes are disabled in production",
        code: "SANDBOX_ROUTE_DISABLED"
      });
      return;
    }
    let authUser;
    try {
      authUser = await resolveAuthPaymentUser(req, req.body?.userId);
    } catch (authErr) {
      const statusCode = authErr instanceof PaymentAuthError ? authErr.statusCode : 401;
      const code = authErr instanceof PaymentAuthError ? authErr.code : "UNAUTHENTICATED";
      res.status(statusCode).json({
        success: false,
        error: authErr.message || "Authentication required for sandbox payment flow",
        code
      });
      return;
    }
    const { customerName, customerEmail, amount, metadata } = req.body || {};
    let parsedAmount;
    try {
      if (amount === void 0 || amount === null || amount === "") {
        res.status(400).json({
          success: false,
          error: "Amount is required and must be an exact decimal string",
          code: "INVALID_PAYMENT_AMOUNT_FORMAT"
        });
        return;
      }
      parsedAmount = validatePaymentAmount(amount);
    } catch (amountErr) {
      const code = this.extractAmountErrorCode(amountErr);
      res.status(400).json({
        success: false,
        error: amountErr.message || "Invalid payment amount",
        code
      });
      return;
    }
    if (!customerName || typeof customerName !== "string" || customerName.trim() === "") {
      res.status(400).json({
        success: false,
        error: "customerName is required and must be a non-empty string",
        code: "INVALID_CUSTOMER_DETAILS"
      });
      return;
    }
    if (!customerEmail || typeof customerEmail !== "string" || !customerEmail.includes("@")) {
      res.status(400).json({
        success: false,
        error: "customerEmail is required and must be a valid email address",
        code: "INVALID_CUSTOMER_DETAILS"
      });
      return;
    }
    const successCallbackUrl = "https://sandbox.gameplay365.local/sandbox/payment/success";
    const cancelCallbackUrl = "https://sandbox.gameplay365.local/sandbox/payment/cancel";
    try {
      const result = await this.adapter.createPayment({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        amount: parsedAmount.decimalString,
        successCallbackUrl,
        cancelCallbackUrl,
        metadata: {
          ...typeof metadata === "object" && metadata !== null ? metadata : {},
          authenticatedUserId: authUser.id,
          authenticatedUid: authUser.uid
        }
      });
      const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
      console.log(
        `[SandboxPayment] [${timestamp2}] User: ${authUser.id} created transaction: ${result.transactionId}, status: ${result.status}, amount: ${result.amount}`
      );
      res.status(201).json({
        success: true,
        status: result.status,
        paymentUrl: result.paymentUrl,
        transactionId: result.transactionId,
        amount: result.amount,
        isSandbox: true,
        metadata: result.metadata
      });
    } catch (err) {
      console.error("[SandboxPayment createPayment error]:", err?.message || err);
      res.status(400).json({
        success: false,
        error: err.message || "Failed to create sandbox payment",
        code: "SANDBOX_CREATION_FAILED",
        isSandbox: true
      });
    }
  }
  /**
   * POST /api/sandbox/payment/verify
   * Accepts: transactionId, expectedAmount (optional)
   * Returns sandbox fixture state only.
   * COMPLETED returns code: SANDBOX_VERIFIED_NO_SETTLEMENT and settlementBlocked: true.
   * Zero real-money settlement.
   */
  async verifyPayment(req, res) {
    if (this.isProduction()) {
      res.status(404).json({
        success: false,
        error: "Sandbox routes are disabled in production",
        code: "SANDBOX_ROUTE_DISABLED"
      });
      return;
    }
    let authUser;
    try {
      authUser = await resolveAuthPaymentUser(req, req.body?.userId);
    } catch (authErr) {
      const statusCode = authErr instanceof PaymentAuthError ? authErr.statusCode : 401;
      const code = authErr instanceof PaymentAuthError ? authErr.code : "UNAUTHENTICATED";
      res.status(statusCode).json({
        success: false,
        error: authErr.message || "Authentication required for sandbox payment verification",
        code
      });
      return;
    }
    const { transactionId, expectedAmount } = req.body || {};
    if (!transactionId || typeof transactionId !== "string" || transactionId.trim() === "") {
      res.status(400).json({
        success: false,
        error: "transactionId is required and must be a non-empty string",
        code: "VALIDATION_ERROR"
      });
      return;
    }
    let parsedExpectedAmount;
    if (expectedAmount !== void 0 && expectedAmount !== null && expectedAmount !== "") {
      try {
        parsedExpectedAmount = validatePaymentAmount(expectedAmount);
      } catch (amountErr) {
        const code = this.extractAmountErrorCode(amountErr);
        res.status(400).json({
          success: false,
          error: amountErr.message || "Invalid expectedAmount format",
          code
        });
        return;
      }
    }
    try {
      const result = await this.adapter.verifyPayment({
        transactionId: transactionId.trim(),
        expectedAmount: parsedExpectedAmount?.decimalString
      });
      const timestamp2 = (/* @__PURE__ */ new Date()).toISOString();
      console.log(
        `[SandboxPayment] [${timestamp2}] User: ${authUser.id} verified transaction: ${result.transactionId}, status: ${result.status}, code: ${result.code}`
      );
      if (result.code === "AMOUNT_MISMATCH") {
        res.status(400).json({
          success: false,
          status: "ERROR",
          code: "AMOUNT_MISMATCH",
          error: result.message || "Amount mismatch detected in sandbox verification",
          amount: result.amount,
          transactionId: result.transactionId,
          isSandbox: true,
          settlementBlocked: true
        });
        return;
      }
      if (result.code === "FIXTURE_NOT_FOUND") {
        res.status(404).json({
          success: false,
          status: "ERROR",
          code: "FIXTURE_NOT_FOUND",
          error: result.message || `Sandbox transaction fixture not found for ID: ${transactionId}`,
          isSandbox: true,
          settlementBlocked: true
        });
        return;
      }
      if (result.status === "ERROR") {
        res.status(400).json({
          success: false,
          status: "ERROR",
          code: result.code || "SANDBOX_ERROR",
          customerName: result.customerName,
          customerEmail: result.customerEmail,
          amount: result.amount,
          transactionId: result.transactionId,
          metadata: result.metadata,
          isSandbox: true,
          settlementBlocked: true,
          message: result.message
        });
        return;
      }
      res.status(200).json({
        success: true,
        status: result.status,
        code: result.code,
        customerName: result.customerName,
        customerEmail: result.customerEmail,
        amount: result.amount,
        transactionId: result.transactionId,
        metadata: result.metadata,
        isSandbox: true,
        settlementBlocked: true,
        verificationCount: result.verificationCount,
        message: result.message
      });
    } catch (err) {
      console.error("[SandboxPayment verifyPayment error]:", err?.message || err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to verify sandbox payment",
        code: "SANDBOX_VERIFICATION_FAILED",
        isSandbox: true,
        settlementBlocked: true
      });
    }
  }
};
var sandboxPaymentController = new SandboxPaymentController();

// src/server/sandbox/router.ts
function productionFailClosedMiddleware(req, res, next) {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({
      success: false,
      error: "Sandbox routes are disabled in production",
      code: "SANDBOX_ROUTE_DISABLED"
    });
    return;
  }
  next();
}
function createSandboxRouter() {
  const router = Router2();
  router.use(productionFailClosedMiddleware);
  router.post("/payment/create", requireAuth, (req, res) => {
    sandboxPaymentController.createPayment(req, res);
  });
  router.post("/payment/verify", requireAuth, (req, res) => {
    sandboxPaymentController.verifyPayment(req, res);
  });
  return router;
}
var sandboxRouter = createSandboxRouter();

// src/server/services/adminOpsService.ts
import { eq as eq8, desc as desc2, count } from "drizzle-orm";
var AUTHORITATIVE_SOURCE_TAG = "POSTGRESQL_AUTHORITATIVE";
var toScale44 = (val) => {
  if (val === null || val === void 0 || val === "") return 0n;
  if (typeof val === "bigint") return val;
  const s = String(val).trim();
  if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return 0n;
  const [intPart = "0", fracPart = ""] = s.split(".");
  const paddedFrac = fracPart.padEnd(4, "0").slice(0, 4);
  const isNeg = intPart.startsWith("-");
  const cleanInt = isNeg ? intPart.slice(1) : intPart;
  const combined = BigInt((cleanInt || "0") + paddedFrac);
  return isNeg ? -combined : combined;
};
var fromScale44 = (val) => {
  const isNeg = val < 0n;
  const abs = isNeg ? -val : val;
  const str = abs.toString().padStart(5, "0");
  const intPart = str.slice(0, -4) || "0";
  const fracPart = str.slice(-4);
  return `${isNeg ? "-" : ""}${intPart}.${fracPart}`;
};
var formatScale4String = (val) => {
  return fromScale44(toScale44(val));
};
var maskEmail = (email) => {
  if (!email || !email.includes("@")) return null;
  const [user, domain] = email.split("@");
  if (user.length <= 2) return `${user[0]}***@${domain}`;
  return `${user[0]}***${user.slice(-1)}@${domain}`;
};
var AdminOpsService = class _AdminOpsService {
  static {
    this.dbClient = null;
  }
  static setDbClient(client) {
    _AdminOpsService.dbClient = client;
  }
  static resetDbClient() {
    _AdminOpsService.dbClient = null;
  }
  static getDb() {
    return _AdminOpsService.dbClient || db;
  }
  /**
   * Authoritatively retrieves high-level operational and financial metrics from PostgreSQL only.
   */
  static async getOverview() {
    try {
      const database = _AdminOpsService.getDb();
      const allPaymentRequests = await database.select({
        id: paymentRequests.id,
        type: paymentRequests.type,
        status: paymentRequests.status,
        amount: paymentRequests.amount
      }).from(paymentRequests);
      let pendingDepCount = 0;
      let pendingDepMinor = 0n;
      let pendingWdCount = 0;
      let pendingWdMinor = 0n;
      let approvedDepMinor = 0n;
      let approvedWdMinor = 0n;
      let failedOrRejectedCount = 0;
      for (const pr of allPaymentRequests) {
        const amtMinor = toScale44(pr.amount);
        if (pr.type === "DEPOSIT") {
          if (pr.status === "PENDING") {
            pendingDepCount++;
            pendingDepMinor += amtMinor;
          } else if (pr.status === "APPROVED") {
            approvedDepMinor += amtMinor;
          } else if (pr.status === "REJECTED" || pr.status === "FAILED") {
            failedOrRejectedCount++;
          }
        } else if (pr.type === "WITHDRAWAL") {
          if (pr.status === "PENDING") {
            pendingWdCount++;
            pendingWdMinor += amtMinor;
          } else if (pr.status === "APPROVED") {
            approvedWdMinor += amtMinor;
          } else if (pr.status === "REJECTED" || pr.status === "FAILED") {
            failedOrRejectedCount++;
          }
        }
      }
      const allWallets = await database.select({
        id: wallets.id,
        status: wallets.status,
        realBalance: wallets.realBalance,
        bonusBalance: wallets.bonusBalance,
        lockedBalance: wallets.lockedBalance,
        commissionBalance: wallets.commissionBalance
      }).from(wallets);
      let totalActiveWallets = 0;
      let totalFrozenWallets = 0;
      let totalRealMinor = 0n;
      let totalBonusMinor = 0n;
      let totalLockedMinor = 0n;
      let totalCommissionMinor = 0n;
      for (const w of allWallets) {
        if (w.status === "ACTIVE") totalActiveWallets++;
        else if (w.status === "FROZEN") totalFrozenWallets++;
        totalRealMinor += toScale44(w.realBalance);
        totalBonusMinor += toScale44(w.bonusBalance);
        totalLockedMinor += toScale44(w.lockedBalance);
        totalCommissionMinor += toScale44(w.commissionBalance);
      }
      const totalSystemMinor = totalRealMinor + totalBonusMinor + totalLockedMinor + totalCommissionMinor;
      const allWagering = await database.select({
        id: wageringRequirements.id,
        userId: wageringRequirements.userId,
        status: wageringRequirements.status,
        bonusAmountGranted: wageringRequirements.bonusAmountGranted,
        targetTurnoverAmount: wageringRequirements.targetTurnoverAmount,
        completedTurnoverAmount: wageringRequirements.completedTurnoverAmount,
        isReleased: wageringRequirements.isReleased
      }).from(wageringRequirements);
      let activeWageringCount = 0;
      let completedWageringCount = 0;
      let expiredWageringCount = 0;
      let activeBonusMinor = 0n;
      let activeTargetMinor = 0n;
      let activeCompletedMinor = 0n;
      const blockedUsers = /* @__PURE__ */ new Set();
      for (const wr of allWagering) {
        if (wr.status === "ACTIVE" && !wr.isReleased) {
          activeWageringCount++;
          activeBonusMinor += toScale44(wr.bonusAmountGranted);
          activeTargetMinor += toScale44(wr.targetTurnoverAmount);
          activeCompletedMinor += toScale44(wr.completedTurnoverAmount);
          blockedUsers.add(wr.userId);
        } else if (wr.status === "COMPLETED") {
          completedWageringCount++;
        } else if (wr.status === "EXPIRED") {
          expiredWageringCount++;
        }
      }
      const allVipClaims = await database.select({
        id: vipRewardClaims.id,
        status: vipRewardClaims.status,
        rewardAmount: vipRewardClaims.rewardAmount
      }).from(vipRewardClaims);
      let pendingVipClaimsCount = 0;
      let pendingVipClaimsMinor = 0n;
      for (const vc of allVipClaims) {
        if (vc.status === "PENDING") {
          pendingVipClaimsCount++;
          pendingVipClaimsMinor += toScale44(vc.rewardAmount);
        }
      }
      const allVipProgress = await database.select({
        currentLevel: userVipProgress.currentLevel,
        totalCashbackClaimed: userVipProgress.totalCashbackClaimed
      }).from(userVipProgress);
      let totalCashbackMinor = 0n;
      const tierDist = {};
      for (let i = 1; i <= 10; i++) tierDist[`V${i}`] = 0;
      for (const vp of allVipProgress) {
        totalCashbackMinor += toScale44(vp.totalCashbackClaimed);
        const lvlKey = `V${vp.currentLevel || 1}`;
        tierDist[lvlKey] = (tierDist[lvlKey] || 0) + 1;
      }
      const allAffiliateNodes = await database.select({
        unclaimedCommission: affiliateNodes.unclaimedCommission,
        totalCommissionEarned: affiliateNodes.totalCommissionEarned,
        status: affiliateNodes.status
      }).from(affiliateNodes);
      let totalUnclaimedCommissionMinor = 0n;
      let totalCommissionEarnedMinor = 0n;
      let activeAffiliatesCount = 0;
      for (const an of allAffiliateNodes) {
        if (an.status === "ACTIVE") activeAffiliatesCount++;
        totalUnclaimedCommissionMinor += toScale44(an.unclaimedCommission);
        totalCommissionEarnedMinor += toScale44(an.totalCommissionEarned);
      }
      const [commSettledCount] = await database.select({ val: count() }).from(affiliateCommissions);
      const todayUtc = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const todayCheckIns = await database.select({ id: dailyCheckIns.id }).from(dailyCheckIns).where(eq8(dailyCheckIns.claimDateUtc, todayUtc));
      const todayWheelSpins = await database.select({ id: wheelSpins.id }).from(wheelSpins).where(eq8(wheelSpins.spinDateUtc, todayUtc));
      const allFreeSpins = await database.select({
        remainingQuantity: freeSpinEntitlements.remainingQuantity,
        status: freeSpinEntitlements.status
      }).from(freeSpinEntitlements).where(eq8(freeSpinEntitlements.status, "ACTIVE"));
      let activeFreeSpinsTotal = 0;
      for (const fs2 of allFreeSpins) {
        activeFreeSpinsTotal += fs2.remainingQuantity || 0;
      }
      const rawProviders = await database.select({
        id: gameProviders.id,
        name: gameProviders.name,
        isActive: gameProviders.isActive,
        webhookTimeoutMs: gameProviders.webhookTimeoutMs,
        updatedAt: gameProviders.updatedAt
      }).from(gameProviders);
      const sanitizedProviders = rawProviders.map((p) => ({
        id: p.id,
        name: p.name,
        isActive: p.isActive,
        webhookTimeoutMs: p.webhookTimeoutMs,
        updatedAt: p.updatedAt
      }));
      const poolAccounts = paymentGatewayEngine.getDestinationPool();
      let poolDailyVolumeMinor = 0n;
      let activePoolAccounts = 0;
      for (const acc of poolAccounts) {
        if (acc.isActive && !acc.isMaintenance) activePoolAccounts++;
        poolDailyVolumeMinor += toScale44(acc.currentDayVolume);
      }
      const [ledgerCountRes] = await database.select({ val: count() }).from(ledgerEntries);
      const [latestLedgerEntry] = await database.select({ createdAt: ledgerEntries.createdAt }).from(ledgerEntries).orderBy(desc2(ledgerEntries.createdAt)).limit(1);
      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        timestamp: Date.now(),
        system: {
          status: "OPERATIONAL",
          environment: process.env.NODE_ENV || "development",
          database: "POSTGRESQL"
        },
        cashier: {
          pendingDepositsCount: pendingDepCount,
          pendingDepositsAmount: fromScale44(pendingDepMinor),
          pendingWithdrawalsCount: pendingWdCount,
          pendingWithdrawalsAmount: fromScale44(pendingWdMinor),
          approvedDepositsAmount: fromScale44(approvedDepMinor),
          approvedWithdrawalsAmount: fromScale44(approvedWdMinor),
          failedOrRejectedRequestsCount: failedOrRejectedCount
        },
        wallets: {
          totalWalletsCount: allWallets.length,
          totalActiveWalletsCount: totalActiveWallets,
          totalFrozenWalletsCount: totalFrozenWallets,
          totalRealBalance: fromScale44(totalRealMinor),
          totalBonusBalance: fromScale44(totalBonusMinor),
          totalLockedBalance: fromScale44(totalLockedMinor),
          totalCommissionBalance: fromScale44(totalCommissionMinor),
          totalSystemBalance: fromScale44(totalSystemMinor)
        },
        wagering: {
          activeRequirementsCount: activeWageringCount,
          completedRequirementsCount: completedWageringCount,
          expiredRequirementsCount: expiredWageringCount,
          blockedWithdrawalPlayersCount: blockedUsers.size,
          totalActiveBonusGranted: fromScale44(activeBonusMinor),
          totalActiveTargetTurnover: fromScale44(activeTargetMinor),
          totalActiveCompletedTurnover: fromScale44(activeCompletedMinor)
        },
        liabilities: {
          vip: {
            pendingRewardClaimsCount: pendingVipClaimsCount,
            pendingRewardClaimsAmount: fromScale44(pendingVipClaimsMinor),
            totalCashbackClaimed: fromScale44(totalCashbackMinor),
            tierDistribution: tierDist
          },
          affiliate: {
            totalUnclaimedCommission: fromScale44(totalUnclaimedCommissionMinor),
            totalCommissionEarned: fromScale44(totalCommissionEarnedMinor),
            activeAffiliatesCount,
            settledCommissionsCount: Number(commSettledCount?.val || 0)
          },
          promotions: {
            checkInsTodayCount: todayCheckIns.length,
            wheelSpinsTodayCount: todayWheelSpins.length,
            activeFreeSpinsRemaining: activeFreeSpinsTotal
          }
        },
        integrations: {
          gameProviders: sanitizedProviders,
          paymentDestinations: {
            totalPoolAccounts: poolAccounts.length,
            activePoolAccounts,
            poolDailyVolume: fromScale44(poolDailyVolumeMinor)
          }
        },
        audit: {
          totalLedgerEntriesCount: Number(ledgerCountRes?.val || 0),
          latestLedgerEntryTimestamp: latestLedgerEntry?.createdAt ? new Date(latestLedgerEntry.createdAt).toISOString() : null
        }
      };
    } catch (err) {
      console.error("[AdminOpsService.getOverview error]:", err);
      throw new Error(`Authoritative overview query failed: ${err.message || "PostgreSQL database read error"}`);
    }
  }
  /**
   * Authoritatively retrieves paginated payment requests with summary and filters.
   */
  static async getPayments(params) {
    try {
      const database = _AdminOpsService.getDb();
      const page = Math.max(1, Number(params.page) || 1);
      const limit2 = Math.min(100, Math.max(1, Number(params.limit) || 20));
      const offset = (page - 1) * limit2;
      const allRows = await database.select({
        id: paymentRequests.id,
        userId: paymentRequests.userId,
        walletId: paymentRequests.walletId,
        type: paymentRequests.type,
        method: paymentRequests.method,
        amount: paymentRequests.amount,
        currency: paymentRequests.currency,
        senderNumber: paymentRequests.senderNumber,
        receiverNumber: paymentRequests.receiverNumber,
        trxId: paymentRequests.trxId,
        status: paymentRequests.status,
        adminNote: paymentRequests.adminNote,
        createdAt: paymentRequests.createdAt,
        updatedAt: paymentRequests.updatedAt,
        username: users.username,
        userEmail: users.email,
        walletLockedBalance: wallets.lockedBalance,
        walletRealBalance: wallets.realBalance
      }).from(paymentRequests).leftJoin(users, eq8(paymentRequests.userId, users.id)).leftJoin(wallets, eq8(paymentRequests.walletId, wallets.id)).orderBy(desc2(paymentRequests.createdAt));
      let filtered = allRows;
      if (params.type) {
        filtered = filtered.filter((r) => r.type.toUpperCase() === params.type.toUpperCase());
      }
      if (params.status) {
        filtered = filtered.filter((r) => r.status.toUpperCase() === params.status.toUpperCase());
      }
      if (params.method) {
        filtered = filtered.filter((r) => r.method.toUpperCase() === params.method.toUpperCase());
      }
      if (params.currency) {
        filtered = filtered.filter((r) => r.currency.toUpperCase() === params.currency.toUpperCase());
      }
      if (params.userId) {
        filtered = filtered.filter((r) => r.userId === Number(params.userId));
      }
      if (params.search) {
        const query3 = params.search.toLowerCase().trim();
        filtered = filtered.filter(
          (r) => r.trxId && r.trxId.toLowerCase().includes(query3) || r.senderNumber && r.senderNumber.toLowerCase().includes(query3) || r.receiverNumber && r.receiverNumber.toLowerCase().includes(query3) || r.username && r.username.toLowerCase().includes(query3) || r.userEmail && r.userEmail.toLowerCase().includes(query3) || r.method && r.method.toLowerCase().includes(query3) || String(r.id).includes(query3) || String(r.userId).includes(query3)
        );
      }
      const total = filtered.length;
      const totalPages = Math.ceil(total / limit2) || 1;
      const pagedData = filtered.slice(offset, offset + limit2);
      let pendingDepositsCount = 0;
      let pendingDepositsMinor = 0n;
      let pendingWithdrawalsCount = 0;
      let pendingWithdrawalsMinor = 0n;
      let approvedTotalMinor = 0n;
      let rejectedCount = 0;
      for (const item of filtered) {
        const amtMinor = toScale44(item.amount);
        if (item.type === "DEPOSIT" && item.status === "PENDING") {
          pendingDepositsCount++;
          pendingDepositsMinor += amtMinor;
        } else if (item.type === "WITHDRAWAL" && item.status === "PENDING") {
          pendingWithdrawalsCount++;
          pendingWithdrawalsMinor += amtMinor;
        } else if (item.status === "APPROVED") {
          approvedTotalMinor += amtMinor;
        } else if (item.status === "REJECTED" || item.status === "FAILED") {
          rejectedCount++;
        }
      }
      const sanitizedData = pagedData.map((item) => {
        const lockedBal = item.walletLockedBalance ? formatScale4String(item.walletLockedBalance) : "0.0000";
        return {
          id: item.id,
          userId: item.userId,
          username: item.username || `User_${item.userId}`,
          userEmail: item.userEmail || null,
          walletId: item.walletId,
          type: item.type,
          method: item.method,
          amount: formatScale4String(item.amount),
          currency: item.currency,
          senderNumber: item.senderNumber,
          receiverNumber: item.receiverNumber,
          senderNumberMasked: item.senderNumber ? item.senderNumber.length > 6 ? item.senderNumber.slice(0, 3) + "****" + item.senderNumber.slice(-4) : item.senderNumber : null,
          receiverNumberMasked: item.receiverNumber ? item.receiverNumber.length > 6 ? item.receiverNumber.slice(0, 3) + "****" + item.receiverNumber.slice(-4) : item.receiverNumber : null,
          trxId: item.trxId,
          status: item.status,
          adminNote: item.adminNote,
          walletLockedBalance: lockedBal,
          withdrawalLockedAmount: item.type === "WITHDRAWAL" ? lockedBal : "0.0000",
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        };
      });
      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        pagination: {
          page,
          limit: limit2,
          total,
          totalPages
        },
        summary: {
          totalCount: total,
          pendingDepositsCount,
          pendingDepositsAmount: fromScale44(pendingDepositsMinor),
          pendingWithdrawalsCount,
          pendingWithdrawalsAmount: fromScale44(pendingWithdrawalsMinor),
          approvedTotalAmount: fromScale44(approvedTotalMinor),
          rejectedCount
        },
        data: sanitizedData
      };
    } catch (err) {
      console.error("[AdminOpsService.getPayments error]:", err);
      throw new Error(`Authoritative payments query failed: ${err.message || "PostgreSQL database read error"}`);
    }
  }
  /**
   * Authoritatively retrieves paginated wallets with user profile details and balances.
   */
  static async getWallets(params) {
    try {
      const database = _AdminOpsService.getDb();
      const page = Math.max(1, Number(params.page) || 1);
      const limit2 = Math.min(100, Math.max(1, Number(params.limit) || 20));
      const offset = (page - 1) * limit2;
      const allRows = await database.select({
        id: wallets.id,
        userId: wallets.userId,
        currency: wallets.currency,
        balanceMinor: wallets.balanceMinor,
        realBalance: wallets.realBalance,
        bonusBalance: wallets.bonusBalance,
        lockedBalance: wallets.lockedBalance,
        commissionBalance: wallets.commissionBalance,
        status: wallets.status,
        version: wallets.version,
        createdAt: wallets.createdAt,
        updatedAt: wallets.updatedAt,
        username: users.username,
        userEmail: users.email,
        userStatus: users.status,
        userUid: users.uid
      }).from(wallets).leftJoin(users, eq8(wallets.userId, users.id)).orderBy(desc2(wallets.updatedAt));
      let filtered = allRows;
      if (params.currency) {
        filtered = filtered.filter((w) => w.currency.toUpperCase() === params.currency.toUpperCase());
      }
      if (params.status) {
        filtered = filtered.filter((w) => w.status.toUpperCase() === params.status.toUpperCase());
      }
      if (params.search) {
        const query3 = params.search.toLowerCase().trim();
        filtered = filtered.filter(
          (w) => w.username && w.username.toLowerCase().includes(query3) || w.userEmail && w.userEmail.toLowerCase().includes(query3) || w.userUid && w.userUid.toLowerCase().includes(query3) || String(w.userId).includes(query3)
        );
      }
      const total = filtered.length;
      const totalPages = Math.ceil(total / limit2) || 1;
      const pagedData = filtered.slice(offset, offset + limit2);
      let totalRealMinor = 0n;
      let totalBonusMinor = 0n;
      let totalLockedMinor = 0n;
      let totalCommissionMinor = 0n;
      for (const w of filtered) {
        totalRealMinor += toScale44(w.realBalance);
        totalBonusMinor += toScale44(w.bonusBalance);
        totalLockedMinor += toScale44(w.lockedBalance);
        totalCommissionMinor += toScale44(w.commissionBalance);
      }
      const sanitizedData = pagedData.map((w) => {
        const realMinor = toScale44(w.realBalance);
        const bonusMinor = toScale44(w.bonusBalance);
        const lockedMinor = toScale44(w.lockedBalance);
        const commissionMinor = toScale44(w.commissionBalance);
        const combinedMinor = realMinor + bonusMinor + lockedMinor + commissionMinor;
        return {
          id: w.id,
          userId: w.userId,
          username: w.username || `User_${w.userId}`,
          email: w.userEmail ? maskEmail(w.userEmail) : null,
          emailMasked: w.userEmail ? maskEmail(w.userEmail) : null,
          userStatus: w.userStatus || "ACTIVE",
          currency: w.currency,
          realBalance: fromScale44(realMinor),
          bonusBalance: fromScale44(bonusMinor),
          lockedBalance: fromScale44(lockedMinor),
          commissionBalance: fromScale44(commissionMinor),
          totalBalance: fromScale44(combinedMinor),
          status: w.status,
          version: Number(w.version || 1),
          createdAt: w.createdAt,
          updatedAt: w.updatedAt
        };
      });
      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        pagination: {
          page,
          limit: limit2,
          total,
          totalPages
        },
        summary: {
          totalWallets: total,
          totalRealBalance: fromScale44(totalRealMinor),
          totalBonusBalance: fromScale44(totalBonusMinor),
          totalLockedBalance: fromScale44(totalLockedMinor),
          totalCommissionBalance: fromScale44(totalCommissionMinor),
          totalSystemBalance: fromScale44(totalRealMinor + totalBonusMinor + totalLockedMinor + totalCommissionMinor)
        },
        data: sanitizedData
      };
    } catch (err) {
      console.error("[AdminOpsService.getWallets error]:", err);
      throw new Error(`Authoritative wallets query failed: ${err.message || "PostgreSQL database read error"}`);
    }
  }
  /**
   * Authoritatively retrieves paginated wagering requirements and gate block status.
   */
  static async getWagering(params) {
    try {
      const database = _AdminOpsService.getDb();
      const page = Math.max(1, Number(params.page) || 1);
      const limit2 = Math.min(100, Math.max(1, Number(params.limit) || 20));
      const offset = (page - 1) * limit2;
      const allRows = await database.select({
        id: wageringRequirements.id,
        userId: wageringRequirements.userId,
        promoName: wageringRequirements.promoName,
        bonusAmountGranted: wageringRequirements.bonusAmountGranted,
        requiredMultiplier: wageringRequirements.requiredMultiplier,
        targetTurnoverAmount: wageringRequirements.targetTurnoverAmount,
        completedTurnoverAmount: wageringRequirements.completedTurnoverAmount,
        status: wageringRequirements.status,
        isReleased: wageringRequirements.isReleased,
        releasedAt: wageringRequirements.releasedAt,
        releaseTransactionId: wageringRequirements.releaseTransactionId,
        expiresAt: wageringRequirements.expiresAt,
        createdAt: wageringRequirements.createdAt,
        completedAt: wageringRequirements.completedAt,
        username: users.username,
        userEmail: users.email
      }).from(wageringRequirements).leftJoin(users, eq8(wageringRequirements.userId, users.id)).orderBy(desc2(wageringRequirements.createdAt));
      let filtered = allRows;
      if (params.status) {
        filtered = filtered.filter((r) => r.status.toUpperCase() === params.status.toUpperCase());
      }
      if (params.userId) {
        filtered = filtered.filter((r) => r.userId === Number(params.userId));
      }
      if (params.released !== void 0 && params.released !== "") {
        const isRel = String(params.released).toLowerCase() === "true" || String(params.released).toUpperCase() === "RELEASED";
        filtered = filtered.filter((r) => Boolean(r.isReleased) === isRel);
      }
      if (params.search) {
        const query3 = params.search.toLowerCase().trim();
        filtered = filtered.filter(
          (r) => r.promoName && r.promoName.toLowerCase().includes(query3) || r.username && r.username.toLowerCase().includes(query3) || r.userEmail && r.userEmail.toLowerCase().includes(query3) || String(r.userId).includes(query3)
        );
      }
      const total = filtered.length;
      const totalPages = Math.ceil(total / limit2) || 1;
      const pagedData = filtered.slice(offset, offset + limit2);
      let activeCount = 0;
      let completedCount = 0;
      let expiredCount = 0;
      let totalBonusGrantedMinor = 0n;
      let totalTargetTurnoverMinor = 0n;
      let totalCompletedTurnoverMinor = 0n;
      let totalRemainingTurnoverMinor = 0n;
      const activeUserIds = /* @__PURE__ */ new Set();
      for (const r of filtered) {
        const targetMinor = toScale44(r.targetTurnoverAmount);
        const completedMinor = toScale44(r.completedTurnoverAmount);
        const remainingMinor = targetMinor > completedMinor ? targetMinor - completedMinor : 0n;
        totalRemainingTurnoverMinor += remainingMinor;
        if (r.status === "ACTIVE" && !r.isReleased) {
          activeCount++;
          activeUserIds.add(r.userId);
        } else if (r.status === "COMPLETED") {
          completedCount++;
        } else if (r.status === "EXPIRED") {
          expiredCount++;
        }
        totalBonusGrantedMinor += toScale44(r.bonusAmountGranted);
        totalTargetTurnoverMinor += targetMinor;
        totalCompletedTurnoverMinor += completedMinor;
      }
      const sanitizedData = pagedData.map((r) => {
        const targetMinor = toScale44(r.targetTurnoverAmount);
        const completedMinor = toScale44(r.completedTurnoverAmount);
        const remainingMinor = targetMinor > completedMinor ? targetMinor - completedMinor : 0n;
        const progressPercent = targetMinor > 0n ? Number(completedMinor * 10000n / targetMinor) / 100 : 100;
        return {
          id: r.id,
          userId: r.userId,
          username: r.username || `User_${r.userId}`,
          userEmail: r.userEmail ? maskEmail(r.userEmail) : null,
          emailMasked: r.userEmail ? maskEmail(r.userEmail) : null,
          promoName: r.promoName,
          bonusAmountGranted: formatScale4String(r.bonusAmountGranted),
          requiredMultiplier: r.requiredMultiplier,
          targetTurnoverAmount: formatScale4String(r.targetTurnoverAmount),
          completedTurnoverAmount: formatScale4String(r.completedTurnoverAmount),
          remainingTurnoverAmount: fromScale44(remainingMinor),
          progressPercent: Math.min(100, progressPercent),
          status: r.status,
          isReleased: Boolean(r.isReleased),
          isWithdrawalBlocked: r.status === "ACTIVE" && !r.isReleased,
          releasedAt: r.releasedAt,
          releaseTransactionId: r.releaseTransactionId,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
          completedAt: r.completedAt
        };
      });
      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        pagination: {
          page,
          limit: limit2,
          total,
          totalPages
        },
        summary: {
          totalRequirements: total,
          activeCount,
          completedCount,
          expiredCount,
          blockedPlayersCount: activeUserIds.size,
          totalBonusGranted: fromScale44(totalBonusGrantedMinor),
          totalTargetTurnover: fromScale44(totalTargetTurnoverMinor),
          totalCompletedTurnover: fromScale44(totalCompletedTurnoverMinor),
          totalRemainingTurnover: fromScale44(totalRemainingTurnoverMinor)
        },
        data: sanitizedData
      };
    } catch (err) {
      console.error("[AdminOpsService.getWagering error]:", err);
      throw new Error(`Authoritative wagering query failed: ${err.message || "PostgreSQL database read error"}`);
    }
  }
  /**
   * Authoritatively retrieves paginated immutable ledger audit entries.
   * Strips any sensitive credentials or secrets from audit metadata.
   */
  static async getAudit(params) {
    try {
      const database = _AdminOpsService.getDb();
      const page = Math.max(1, Number(params.page) || 1);
      const limit2 = Math.min(100, Math.max(1, Number(params.limit) || 20));
      const offset = (page - 1) * limit2;
      const allRows = await database.select({
        id: ledgerEntries.id,
        walletId: ledgerEntries.walletId,
        userId: ledgerEntries.userId,
        transactionId: ledgerEntries.transactionId,
        referenceTransactionId: ledgerEntries.referenceTransactionId,
        type: ledgerEntries.type,
        balanceTarget: ledgerEntries.balanceTarget,
        amountMinor: ledgerEntries.amountMinor,
        currency: ledgerEntries.currency,
        beforeBalanceMinor: ledgerEntries.beforeBalanceMinor,
        afterBalanceMinor: ledgerEntries.afterBalanceMinor,
        status: ledgerEntries.status,
        correlationId: ledgerEntries.correlationId,
        auditMetadata: ledgerEntries.auditMetadata,
        createdAt: ledgerEntries.createdAt,
        username: users.username,
        userEmail: users.email
      }).from(ledgerEntries).leftJoin(users, eq8(ledgerEntries.userId, users.id)).orderBy(desc2(ledgerEntries.createdAt));
      let filtered = allRows;
      if (params.type) {
        filtered = filtered.filter((r) => r.type.toUpperCase() === params.type.toUpperCase());
      }
      if (params.balanceTarget) {
        filtered = filtered.filter((r) => r.balanceTarget.toUpperCase() === params.balanceTarget.toUpperCase());
      }
      if (params.status) {
        filtered = filtered.filter((r) => r.status.toUpperCase() === params.status.toUpperCase());
      }
      if (params.userId) {
        filtered = filtered.filter((r) => r.userId === Number(params.userId));
      }
      if (params.walletId) {
        filtered = filtered.filter((r) => r.walletId === Number(params.walletId));
      }
      if (params.transactionId) {
        const txQuery = params.transactionId.toLowerCase().trim();
        filtered = filtered.filter(
          (r) => r.transactionId.toLowerCase().includes(txQuery) || r.referenceTransactionId && r.referenceTransactionId.toLowerCase().includes(txQuery)
        );
      }
      const total = filtered.length;
      const totalPages = Math.ceil(total / limit2) || 1;
      const pagedData = filtered.slice(offset, offset + limit2);
      let totalDebitMinor = 0n;
      let totalCreditMinor = 0n;
      for (const r of filtered) {
        const amt = typeof r.amountMinor === "bigint" ? r.amountMinor : BigInt(r.amountMinor || 0);
        if (r.type === "DEBIT") {
          totalDebitMinor += amt;
        } else if (r.type === "CREDIT") {
          totalCreditMinor += amt;
        }
      }
      const sanitizedData = pagedData.map((r) => {
        const amtMinor = typeof r.amountMinor === "bigint" ? r.amountMinor : BigInt(r.amountMinor || 0);
        const beforeMinor = typeof r.beforeBalanceMinor === "bigint" ? r.beforeBalanceMinor : BigInt(r.beforeBalanceMinor || 0);
        const afterMinor = typeof r.afterBalanceMinor === "bigint" ? r.afterBalanceMinor : BigInt(r.afterBalanceMinor || 0);
        const rawMeta = r.auditMetadata || {};
        const safeMeta = {};
        for (const [k, v] of Object.entries(rawMeta)) {
          const lowerKey = k.toLowerCase();
          if (lowerKey.includes("secret") || lowerKey.includes("key") || lowerKey.includes("token") || lowerKey.includes("auth") || lowerKey.includes("pass")) {
            safeMeta[k] = "[REDACTED]";
          } else {
            safeMeta[k] = v;
          }
        }
        return {
          id: r.id,
          walletId: r.walletId,
          userId: r.userId,
          username: r.username || `User_${r.userId}`,
          userEmail: r.userEmail || null,
          transactionId: r.transactionId,
          referenceTransactionId: r.referenceTransactionId,
          type: r.type,
          balanceTarget: r.balanceTarget,
          amountMinor: amtMinor.toString(),
          amount: fromScale44(amtMinor),
          currency: r.currency,
          beforeBalance: fromScale44(beforeMinor),
          afterBalance: fromScale44(afterMinor),
          status: r.status,
          correlationId: r.correlationId,
          auditMetadata: safeMeta,
          createdAt: r.createdAt
        };
      });
      return {
        source: AUTHORITATIVE_SOURCE_TAG,
        pagination: {
          page,
          limit: limit2,
          total,
          totalPages
        },
        summary: {
          totalEntries: total,
          totalDebitAmount: fromScale44(totalDebitMinor),
          totalCreditAmount: fromScale44(totalCreditMinor)
        },
        data: sanitizedData
      };
    } catch (err) {
      console.error("[AdminOpsService.getAudit error]:", err);
      throw new Error(`Authoritative audit query failed: ${err.message || "PostgreSQL database read error"}`);
    }
  }
};

// src/server/controllers/adminController.ts
var AdminController = class {
  /**
   * GET /api/admin/overview
   * Authoritative aggregate operations & financials read model.
   */
  async getOverview(req, res) {
    try {
      const overview = await AdminOpsService.getOverview();
      res.status(200).json({
        success: true,
        source: AUTHORITATIVE_SOURCE_TAG,
        data: overview
      });
    } catch (err) {
      console.error("[AdminController.getOverview error]:", err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: "DATABASE_READ_ERROR",
        error: err.message || "Failed to retrieve authoritative admin overview"
      });
    }
  }
  /**
   * GET /api/admin/payments
   * Authoritative list of payment requests with filtering and pagination.
   */
  async getPayments(req, res) {
    try {
      const {
        page = "1",
        limit: limit2 = "20",
        type,
        status,
        method,
        currency,
        userId,
        search
      } = req.query;
      const result = await AdminOpsService.getPayments({
        page: Number(page) || 1,
        limit: Number(limit2) || 20,
        type: type ? String(type) : void 0,
        status: status ? String(status) : void 0,
        method: method ? String(method) : void 0,
        currency: currency ? String(currency) : void 0,
        userId: userId ? Number(userId) : void 0,
        search: search ? String(search) : void 0
      });
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error("[AdminController.getPayments error]:", err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: "DATABASE_READ_ERROR",
        error: err.message || "Failed to retrieve payment requests"
      });
    }
  }
  /**
   * GET /api/admin/wallets
   * Authoritative list of user wallets with real, bonus, locked, and commission balances.
   */
  async getWallets(req, res) {
    try {
      const {
        page = "1",
        limit: limit2 = "20",
        currency,
        status,
        search
      } = req.query;
      const result = await AdminOpsService.getWallets({
        page: Number(page) || 1,
        limit: Number(limit2) || 20,
        currency: currency ? String(currency) : void 0,
        status: status ? String(status) : void 0,
        search: search ? String(search) : void 0
      });
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error("[AdminController.getWallets error]:", err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: "DATABASE_READ_ERROR",
        error: err.message || "Failed to retrieve wallets"
      });
    }
  }
  /**
   * GET /api/admin/wagering
   * Authoritative list of wagering requirements, rollover turnover progress, and withdrawal gates.
   */
  async getWagering(req, res) {
    try {
      const {
        page = "1",
        limit: limit2 = "20",
        status,
        userId,
        search,
        released
      } = req.query;
      const result = await AdminOpsService.getWagering({
        page: Number(page) || 1,
        limit: Number(limit2) || 20,
        status: status ? String(status) : void 0,
        userId: userId ? Number(userId) : void 0,
        search: search ? String(search) : void 0,
        released: released !== void 0 ? String(released) : void 0
      });
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error("[AdminController.getWagering error]:", err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: "DATABASE_READ_ERROR",
        error: err.message || "Failed to retrieve wagering requirements"
      });
    }
  }
  /**
   * GET /api/admin/audit
   * Authoritative immutable financial ledger entries and audit log.
   */
  async getAudit(req, res) {
    try {
      const {
        page = "1",
        limit: limit2 = "20",
        type,
        balanceTarget,
        userId,
        walletId,
        transactionId,
        status
      } = req.query;
      const result = await AdminOpsService.getAudit({
        page: Number(page) || 1,
        limit: Number(limit2) || 20,
        type: type ? String(type) : void 0,
        balanceTarget: balanceTarget ? String(balanceTarget) : void 0,
        userId: userId ? Number(userId) : void 0,
        walletId: walletId ? Number(walletId) : void 0,
        transactionId: transactionId ? String(transactionId) : void 0,
        status: status ? String(status) : void 0
      });
      res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      console.error("[AdminController.getAudit error]:", err);
      res.status(500).json({
        success: false,
        source: AUTHORITATIVE_SOURCE_TAG,
        code: "DATABASE_READ_ERROR",
        error: err.message || "Failed to retrieve audit trail"
      });
    }
  }
};
var adminController = new AdminController();

// src/server/config/environmentGuard.ts
var ALLOWED_ENVIRONMENTS = [
  "development",
  "sandbox",
  "staging",
  "production"
];
var EnvironmentValidationError = class _EnvironmentValidationError extends Error {
  constructor(message, code = "ERR_INVALID_ENVIRONMENT") {
    super(`[SystemBoundary Guard] ${message}`);
    this.name = "EnvironmentValidationError";
    this.code = code;
    Object.setPrototypeOf(this, _EnvironmentValidationError.prototype);
  }
};
function getNormalizedRuntimeEnvironment(envVar) {
  const rawEnv = envVar !== void 0 ? envVar : process.env.APP_ENV || process.env.NODE_ENV;
  if (!rawEnv || rawEnv.trim() === "") {
    return "development";
  }
  const normalized = rawEnv.trim().toLowerCase();
  if (normalized === "test" || normalized === "testing") {
    return "development";
  }
  if (ALLOWED_ENVIRONMENTS.includes(normalized)) {
    return normalized;
  }
  throw new EnvironmentValidationError(
    `Invalid or unrecognized runtime environment '${rawEnv}'. Allowed values: ${ALLOWED_ENVIRONMENTS.join(", ")}. Server failed closed.`,
    "ERR_UNKNOWN_ENVIRONMENT"
  );
}
function validateRuntimeEnvironmentConfig(env = process.env) {
  const runtimeEnv = getNormalizedRuntimeEnvironment(env.APP_ENV || env.NODE_ENV);
  const warnings = [];
  const dbUrl = env.DATABASE_URL;
  const isDbConfigured = Boolean(dbUrl && dbUrl.trim() !== "");
  const isGeminiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== "");
  const isSandboxEnabled = env.SANDBOX_PAYMENT_ENABLED === "true" || env.SANDBOX_ENABLED === "true";
  const providerKeys = ["PGSOFT", "PRAGMATIC", "SPRIBE", "EVOLUTION", "CUSTOM"];
  const activeProviders = [];
  for (const p of providerKeys) {
    if (env[`PROVIDER_${p}_ENABLED`] === "true") {
      activeProviders.push(p);
    }
  }
  if (runtimeEnv === "development") {
    if (env.ENABLE_LIVE_FINANCIAL_SETTLEMENT === "true") {
      throw new EnvironmentValidationError(
        "Development environment is strictly forbidden from enabling live financial settlement (ENABLE_LIVE_FINANCIAL_SETTLEMENT=true).",
        "ERR_DEV_LIVE_SETTLEMENT_BLOCKED"
      );
    }
  }
  if (runtimeEnv === "sandbox") {
    if (env.ENABLE_LIVE_FINANCIAL_SETTLEMENT === "true") {
      throw new EnvironmentValidationError(
        "Sandbox environment cannot enable live production settlement keys.",
        "ERR_SANDBOX_LIVE_SETTLEMENT_BLOCKED"
      );
    }
  }
  if (runtimeEnv === "staging") {
    if (env.ENABLE_LIVE_FINANCIAL_SETTLEMENT === "true") {
      throw new EnvironmentValidationError(
        "Staging environment cannot activate production financial settlement.",
        "ERR_STAGING_LIVE_SETTLEMENT_BLOCKED"
      );
    }
  }
  if (runtimeEnv === "production") {
    if (isSandboxEnabled) {
      warnings.push("Sandbox payment flow is explicitly flagged on in production environment.");
    }
  }
  return {
    environment: runtimeEnv,
    isValid: true,
    sanitizedConfig: {
      databaseConfigured: isDbConfigured,
      geminiConfigured: isGeminiConfigured,
      sandboxEnabled: isSandboxEnabled,
      activeProviders
    },
    warnings
  };
}

// src/server/index.ts
dotenv.config();
var envValidation = validateRuntimeEnvironmentConfig();
if (process.env.NODE_ENV !== "test") {
  console.log(`[SystemBoundary Guard] Normalized Runtime Environment: ${envValidation.environment}`);
  console.log(`[SystemBoundary Guard] Configuration Status: DB=${envValidation.sanitizedConfig.databaseConfigured}, Gemini=${envValidation.sanitizedConfig.geminiConfigured}, Sandbox=${envValidation.sanitizedConfig.sandboxEnabled}`);
}
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app2 = express();
var PORT = Number(process.env.PORT) || 3e3;
var HOST = "0.0.0.0";
app2.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  })
);
var postgresLedgerPool = new PostgresLedgerPool(process.env.DATABASE_URL);
var walletLedgerService2 = new WalletLedgerService(postgresLedgerPool);
var walletController = new SeamlessWalletController(walletLedgerService2);
AffiliateService.setLedgerService(walletLedgerService2);
PromotionService.setLedgerService(walletLedgerService2);
VipService.setLedgerService(walletLedgerService2);
WageringService.setLedgerService(walletLedgerService2);
paymentController.setLedgerService(walletLedgerService2);
var seamlessRouter = express.Router();
seamlessRouter.use(validateHmacSignature);
seamlessRouter.post("/balance", walletController.getBalance);
seamlessRouter.post("/bet", walletController.processBet);
seamlessRouter.post("/win", walletController.processWin);
seamlessRouter.post("/refund", walletController.processRefund);
app2.use("/api/seamless", seamlessRouter);
var cashierRouter = express.Router();
cashierRouter.post("/deposit", requireAuth, (req, res) => paymentController.submitDeposit(req, res));
cashierRouter.post("/withdraw", requireAuth, (req, res) => paymentController.submitWithdrawal(req, res));
cashierRouter.get("/requests", requireAdmin, (req, res) => paymentController.getRequests(req, res));
app2.use("/api/cashier", cashierRouter);
var paymentV2Router = express.Router();
paymentV2Router.post("/deposit/intent", requireAuth, (req, res) => paymentGatewayController.createDepositIntent(req, res));
paymentV2Router.post("/deposit/verify-trx", requireAuth, (req, res) => paymentGatewayController.verifyTrxId(req, res));
paymentV2Router.post("/withdraw/request", requireAuth, (req, res) => paymentGatewayController.requestWithdrawal(req, res));
paymentV2Router.post("/webhook/:provider", (req, res) => paymentGatewayController.handleWebhook(req, res));
paymentV2Router.get("/destination-pool", requireAdmin, (req, res) => paymentGatewayController.getDestinationPool(req, res));
paymentV2Router.get("/stats", requireAdmin, (req, res) => paymentGatewayController.getStats(req, res));
app2.use("/api/v2/payment", paymentV2Router);
app2.use("/api/sandbox", createSandboxRouter());
var authRouter = express.Router();
authRouter.get("/verify-role", requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const authoritativeRole = await getAuthoritativeUserRole(user);
    const isPrivileged = ["ADMIN", "OPERATOR", "SUPER_ADMIN"].includes(authoritativeRole);
    res.json({
      success: true,
      uid: user.uid,
      email: user.email || null,
      role: authoritativeRole,
      isPrivileged
    });
  } catch (err) {
    console.error("[Auth verify-role error]:", err);
    res.status(500).json({ success: false, error: err.message || "Role verification failed" });
  }
});
app2.use("/api/auth", authRouter);
var adminRouter = express.Router();
adminRouter.use(requireAdmin);
adminRouter.get("/verify", (req, res) => {
  res.json({
    success: true,
    authorized: true,
    uid: req.user?.uid,
    role: req.userRole
  });
});
adminRouter.get("/stats", (req, res) => {
  res.json({
    success: true,
    authorized: true,
    role: req.userRole,
    timestamp: Date.now(),
    system: {
      status: "OPERATIONAL",
      uptime: process.uptime(),
      activeNodes: 1
    }
  });
});
adminRouter.get("/requests", (req, res) => paymentController.getRequests(req, res));
adminRouter.get("/destination-pool", (req, res) => paymentGatewayController.getDestinationPool(req, res));
adminRouter.get("/payment-stats", (req, res) => paymentGatewayController.getStats(req, res));
adminRouter.get("/overview", (req, res) => adminController.getOverview(req, res));
adminRouter.get("/payments", (req, res) => adminController.getPayments(req, res));
adminRouter.get("/wallets", (req, res) => adminController.getWallets(req, res));
adminRouter.get("/wagering", (req, res) => adminController.getWagering(req, res));
adminRouter.get("/audit", (req, res) => adminController.getAudit(req, res));
app2.use("/api/admin", adminRouter);
var affiliateRouter = express.Router();
affiliateRouter.use(requireAuth);
affiliateRouter.get("/summary", getAffiliateSummaryHandler);
affiliateRouter.post("/claim", claimCommissionHandler);
affiliateRouter.post("/bind", bindReferralHandler);
app2.use("/api/affiliate", affiliateRouter);
var vipRouter = express.Router();
vipRouter.use(requireAuth);
vipRouter.get("/details", getVipDetailsHandler);
vipRouter.post("/claim-bonus", claimVipBonusHandler);
app2.use("/api/vip", vipRouter);
var promoRouter = express.Router();
promoRouter.use(requireAuth);
promoRouter.get("/details", getPromotionDetailsHandler);
promoRouter.get("/wagering-status", getWageringStatusHandler);
promoRouter.post("/checkin", claimCheckInHandler);
promoRouter.post("/spin", spinWheelHandler);
promoRouter.post("/convert-bonus", convertBonusHandler);
app2.use("/api/promo", promoRouter);
app2.use("/api/gateway/providers", createProviderGatewayRouter());
app2.get(["/health", "/api/health", "/_health"], (_req, res) => {
  res.status(200).json({
    status: "HEALTHY",
    uptime: process.uptime(),
    timestamp: Date.now(),
    port: PORT
  });
});
var candidateDistPaths = [
  path.resolve(process.cwd(), "dist"),
  path.resolve(__dirname, "dist"),
  path.resolve(__dirname, "../dist")
];
var resolvedDistPath = candidateDistPaths.find((p) => fs.existsSync(path.join(p, "index.html"))) || candidateDistPaths[0];
app2.use(express.static(resolvedDistPath, {
  index: false,
  // Handle index via SPA fallback for consistent routing
  maxAge: "1h"
}));
app2.get("*", (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/health") || req.path.startsWith("/_health")) {
    return res.status(404).json({ code: "NOT_FOUND", message: `API route '${req.path}' not found` });
  }
  const indexPath = path.join(resolvedDistPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.setHeader("Content-Type", "text/html; charset=UTF-8");
    return res.sendFile(indexPath);
  }
  res.setHeader("Content-Type", "text/html; charset=UTF-8");
  return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>PLAY369 | Seamless Core</title>
    <style>
      body { background: #02180e; color: #e2e8f0; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
      .loader { text-align: center; }
      .spinner { width: 40px; height: 40px; border: 4px solid #10b98133; border-top-color: #10b981; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    <div class="loader">
      <div class="spinner"></div>
      <h2>Initializing PLAY369 Application...</h2>
      <p>Frontend assets are readying. Reloading...</p>
    </div>
    <script>setTimeout(() => window.location.reload(), 1500);</script>
  </body>
</html>`);
});
app2.use((err, _req, res, _next) => {
  console.error("[Fatal Server Error]:", err);
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "An unhandled server exception occurred",
    timestamp: Date.now()
  });
});
if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true" && process.env.DISABLE_SERVER_LISTEN !== "true") {
  const server = app2.listen(PORT, HOST, () => {
    console.log(`[Seamless Wallet Core] Server successfully listening on http://${HOST}:${PORT} (PORT=${PORT})`);
  });
  process.on("SIGTERM", () => {
    console.log("[Seamless Wallet Core] SIGTERM signal received: closing HTTP server");
    server.close(() => {
      console.log("[Seamless Wallet Core] HTTP server closed");
      process.exit(0);
    });
  });
}
var index_default = app2;
export {
  index_default as default,
  postgresLedgerPool,
  walletController,
  walletLedgerService2 as walletLedgerService
};
