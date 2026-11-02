// Print the sponsor page itself so the website and PDF share one source of truth.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, writeFile, copyFile, rm } from 'node:fs/promises';
import { withBrowserPage } from './browser.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'data-fest-prospectus-'));
const port = 5184;
const url = `http://127.0.0.1:${port}/sponsor.html`;
let server;
try {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  server.stdout.on('data', chunk => { output += chunk; });
  server.stderr.on('data', chunk => { output += chunk; });
  const deadline = Date.now() + 15000;
  // Wait for our own process's readiness before making a functional request.
  while (!output.includes('Local:')) {
    if (server.exitCode !== null || Date.now() > deadline) throw new Error(`Vite did not start: ${output}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const response = await fetch(url);
  if (!response.ok || !(await response.text()).includes('sponsor-heading')) throw new Error('Sponsor page readiness failed');
  const pdf = join(temp, 'prospectus.pdf');
  const bytes = await withBrowserPage(url, async ({command}) => {
    const result = await command('Page.printToPDF', {printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false});
    return Buffer.from(result.data, 'base64');
  });
  if (bytes.subarray(0, 5).toString() !== '%PDF-' || bytes.length < 10000) throw new Error('Invalid PDF output');
  await writeFile(pdf, bytes);
  await copyFile(pdf, join(root, 'public/acalanes-data-fest-sponsorship.pdf'));
  console.log(`Generated public/acalanes-data-fest-sponsorship.pdf (${bytes.length} bytes). Run npm run build to include it in dist/.`);
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
