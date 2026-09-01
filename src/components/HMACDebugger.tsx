import React, { useState, useEffect } from 'react';
import {
  Key,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  RefreshCw,
  Clock,
  Sparkles
} from 'lucide-react';

const PROVIDER_SECRETS: Record<string, string> = {
  pragmatic_play: 'sk_live_pragmatic_seamless_88492048102',
  evolution: 'sk_live_evolution_seamless_39104859103',
  pgsoft: 'sk_live_pgsoft_seamless_91823019482',
  spribe: 'sk_live_spribe_seamless_74910284910',
  custom_provider: 'sk_live_custom_seamless_secret_123456'
};

async function computeHmac(secretKey: string, message: string) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const HMACDebugger: React.FC = () => {
  const [providerId, setProviderId] = useState<string>('pragmatic_play');
  const [secretKey, setSecretKey] = useState<string>(
    PROVIDER_SECRETS['pragmatic_play'] || 'sk_live_pragmatic_seamless_88492048102'
  );
  const [timestamp, setTimestamp] = useState<number>(Date.now());
  const [endpoint, setEndpoint] = useState<string>('bet');
  const [payloadJson, setPayloadJson] = useState<string>(
    JSON.stringify(
      {
        provider_id: 'pragmatic_play',
        user_id: 'a0000000-0000-0000-0000-000000000001',
        currency: 'USD',
        transaction_id: 'TX_881920',
        round_id: 'RND_491028',
        game_id: 'vs20sweetbonanza',
        amount: 25.0
      },
      null,
      2
    )
  );

  const [copiedHmac, setCopiedHmac] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [computedSignature, setComputedSignature] = useState<string>('');

  // Compute live HMAC
  useEffect(() => {
    let rawBody = payloadJson;
    try {
      rawBody = JSON.stringify(JSON.parse(payloadJson));
    } catch (e) {
      // Keep as is if invalid JSON
    }

    const messageToSign = `${timestamp}.${rawBody}`;
    computeHmac(secretKey, messageToSign)
      .then(sig => setComputedSignature(sig))
      .catch(err => console.error('Failed to compute HMAC', err));
  }, [payloadJson, timestamp, secretKey]);

  let rawBodyForCurl = payloadJson;
  try {
    rawBodyForCurl = JSON.stringify(JSON.parse(payloadJson));
  } catch (e) {
    // Keep as is
  }

  // Generate curl command
  const curlCommand = `curl -X POST "https://api.yourcasino.com/api/seamless/${endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-Provider-Id: ${providerId}" \\
  -H "X-Timestamp: ${timestamp}" \\
  -H "X-Signature: ${computedSignature}" \\
  -d '${rawBodyForCurl}'`;

  const handleCopyHmac = () => {
    navigator.clipboard.writeText(computedSignature);
    setCopiedHmac(true);
    setTimeout(() => setCopiedHmac(false), 2000);
  };

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Key className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-white">
                HMAC-SHA256 Signature Calculator &amp; cURL Generator
              </h2>
              <p className="text-xs text-slate-400">
                Utility for Game Provider integration engineers to test cryptographic signatures and copy test requests.
              </p>
            </div>
          </div>
          <button
            onClick={() => setTimestamp(Date.now())}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            <RefreshCw className="w-3 h-3 text-cyan-400" />
            <span>Now ({timestamp})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Provider ID</label>
            <input
              type="text"
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                if (PROVIDER_SECRETS[e.target.value]) {
                  setSecretKey(PROVIDER_SECRETS[e.target.value]);
                }
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Shared Secret Key
            </label>
            <input
              type="text"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Timestamp (Epoch ms)</label>
            <input
              type="number"
              value={timestamp}
              onChange={(e) => setTimestamp(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Endpoint</label>
            <select
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="balance">/balance</option>
              <option value="bet">/bet</option>
              <option value="win">/win</option>
              <option value="refund">/refund</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Raw JSON Request Body
          </label>
          <textarea
            rows={7}
            value={payloadJson}
            onChange={(e) => setPayloadJson(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Output Computed Signature */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Generated X-Signature (HMAC-SHA256)
            </span>
            <button
              onClick={handleCopyHmac}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedHmac ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedHmac ? 'Copied' : 'Copy Hash'}
            </button>
          </div>
          <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono font-bold text-cyan-300 break-all select-all">
            {computedSignature}
          </div>
        </div>

        {/* cURL Command Generator */}
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-orange-400" />
              Ready-to-use cURL Snippet
            </span>
            <button
              onClick={handleCopyCurl}
              className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-mono"
            >
              {copiedCurl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedCurl ? 'Copied' : 'Copy cURL'}
            </button>
          </div>
          <pre className="p-3 bg-slate-900 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
            {curlCommand}
          </pre>
        </div>
      </div>
    </div>
  );
};
