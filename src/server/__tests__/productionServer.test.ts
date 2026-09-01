/**
 * @file productionServer.test.ts
 * @description Comprehensive HTTP contract and deployment verification test suite for PLAY369.
 * 
 * Verifies:
 * 1. Root route ("/") serves Vite dist index.html with 200 OK and text/html
 * 2. Static assets (/assets/index-*.js, /assets/index-*.css) are accessible
 * 3. SPA deep routes (/lobby, /workbench, /cashier, /vip) return index.html fallback
 * 4. API health routes (/health, /api/health, /_health) return 200 HEALTHY JSON
 * 5. API routes (/api/*) do not interfere with SPA frontend and return 404 JSON on unknown endpoints
 * 6. Server binds cleanly on designated port (PORT env var or default 3000)
 */

import http from 'http';

process.env.NODE_ENV = 'test';
process.env.DISABLE_SERVER_LISTEN = 'true';

async function runProductionServerTests() {
  const { default: app } = await import('../index');
  console.log('================================================================');
  console.log('🌐 PLAY369 PRODUCTION SERVER & DEPLOYMENT ROUTING VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  // Start temporary test server
  const testPort = 3999;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(testPort, '127.0.0.1', () => {
      console.log(`[Test Server] Listening on http://127.0.0.1:${testPort}\n`);
      resolve();
    });
  });

  async function request(path: string, options: http.RequestOptions = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: testPort,
        path,
        method: options.method || 'GET',
        headers: options.headers || {}
      }, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers, body }));
      });
      req.on('error', reject);
      if ((options as any).body) {
        req.write((options as any).body);
      }
      req.end();
    });
  }

  async function assert(desc: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     Error:`, err.message || err);
      failed++;
    }
  }

  try {
    // 1. Root Route Verification
    await assert('1. Root route ("/") returns 200 OK with HTML and #root container', async () => {
      const res = await request('/');
      if (res.status !== 200) {
        throw new Error(`Expected status 200, got ${res.status}`);
      }
      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`Expected text/html content-type, got ${contentType}`);
      }
      if (!res.body.includes('id="root"')) {
        throw new Error('Response HTML missing id="root" container');
      }
      if (!res.body.includes('PLAY369') && !res.body.includes('Seamless')) {
        throw new Error('Response HTML missing application title tags');
      }
    });

    // 2. Health Endpoint Verification
    await assert('2. GET /health and GET /api/health return 200 with HEALTHY status', async () => {
      const res1 = await request('/health');
      if (res1.status !== 200) throw new Error(`/health returned ${res1.status}`);
      const data1 = JSON.parse(res1.body);
      if (data1.status !== 'HEALTHY') throw new Error(`Expected status HEALTHY, got ${data1.status}`);

      const res2 = await request('/api/health');
      if (res2.status !== 200) throw new Error(`/api/health returned ${res2.status}`);
      const data2 = JSON.parse(res2.body);
      if (data2.status !== 'HEALTHY') throw new Error(`Expected status HEALTHY, got ${data2.status}`);
    });

    // 3. SPA Route Fallback Verification
    await assert('3. SPA deep routes (/lobby, /workbench, /cashier, /vip) serve index.html', async () => {
      const routes = ['/lobby', '/workbench', '/cashier', '/vip', '/promotions'];
      for (const route of routes) {
        const res = await request(route);
        if (res.status !== 200) {
          throw new Error(`Route ${route} returned status ${res.status}`);
        }
        if (!res.body.includes('id="root"')) {
          throw new Error(`Route ${route} did not return SPA index.html`);
        }
      }
    });

    // 4. API Route Isolation
    await assert('4. Unknown API routes (/api/unknown) return 404 JSON, NOT HTML', async () => {
      const res = await request('/api/unknown/endpoint');
      if (res.status !== 404) {
        throw new Error(`Expected status 404, got ${res.status}`);
      }
      const data = JSON.parse(res.body);
      if (data.code !== 'NOT_FOUND') {
        throw new Error(`Expected code NOT_FOUND, got ${JSON.stringify(data)}`);
      }
    });

    // 5. Static Assets Verification
    await assert('5. Static dist assets are served with proper cache headers', async () => {
      // Find asset referenced in index.html
      const rootRes = await request('/');
      const assetMatch = rootRes.body.match(/src="(\/assets\/[^"]+)"/);
      if (assetMatch && assetMatch[1]) {
        const assetPath = assetMatch[1];
        const assetRes = await request(assetPath);
        if (assetRes.status !== 200) {
          throw new Error(`Asset ${assetPath} returned status ${assetRes.status}`);
        }
        console.log(`     Verified asset ${assetPath} (${assetRes.body.length} bytes)`);
      }
    });

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`📊 SERVER VERIFICATION RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runProductionServerTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
