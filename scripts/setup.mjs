import './check-node.mjs';
import { copyFileSync, existsSync } from 'node:fs';
if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env with isolated demo mode. Existing configuration is never overwritten.');
}
