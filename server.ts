/**
 * @file server.ts
 * @description Production Server Entrypoint for Full-Stack Playall 365 Architecture.
 */

import fs from 'fs';
import path from 'path';

// If pre-bundled index.js exists, import it; otherwise import TypeScript source
if (fs.existsSync(path.resolve(process.cwd(), 'index.js'))) {
  await import('./index.js');
} else {
  await import('./src/server/index.js');
}
