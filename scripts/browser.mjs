// Minimal Chromium DevTools client, using Node's built-in WebSocket.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

export async function withBrowserPage(url, action) {
  const temp = await mkdtemp(join(tmpdir(), 'data-fest-browser-'));
  const browser = spawn(process.env.CHROMIUM_PATH || 'chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--remote-debugging-port=0', `--user-data-dir=${temp}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timer = setTimeout(() => reject(new Error(`Chromium startup timeout: ${output}`)), 15000);
      browser.once('error', error => { clearTimeout(timer); reject(error); });
      browser.once('exit', code => { clearTimeout(timer); reject(new Error(`Chromium exited ${code}: ${output}`)); });
      browser.stderr.on('data', chunk => {
        output += chunk;
        const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); }
      });
    });
    const target = await (await fetch(new URL('/json/new?about:blank', endpoint.replace('ws:', 'http:')), { method: 'PUT' })).json();
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await once(socket, 'open');
    let serial = 0;
    const pending = new Map();
    socket.addEventListener('message', ({data}) => {
      const message = JSON.parse(data);
      const callback = pending.get(message.id);
      if (callback) { pending.delete(message.id); callback(message); }
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++serial;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
      pending.set(id, message => { clearTimeout(timer); message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result); });
      socket.send(JSON.stringify({id,method,params}));
    });
    const evaluate = async expression => {
      const response = await command('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true});
      if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
      return response.result.value;
    };
    await command('Page.enable');
    const navigation = await command('Page.navigate', {url});
    if (navigation.errorText) throw new Error(navigation.errorText);
    await evaluate(`new Promise(resolve => { if (document.readyState === 'complete') resolve(); else addEventListener('load', resolve, {once:true}); }).then(() => document.fonts.ready).then(() => true)`);
    return await action({command,evaluate});
  } finally {
    socket?.close();
    if (browser.exitCode === null) { browser.kill('SIGTERM'); await once(browser, 'exit'); }
    await rm(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
