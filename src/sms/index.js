import { spawn } from 'node:child_process';

export function hasSmsCommand() {
  return new Promise((resolve) => {
    const process = spawn('sh', ['-lc', 'command -v termux-sms-send'], { stdio: 'ignore' });
    process.on('close', (code) => resolve(code === 0));
    process.on('error', () => resolve(false));
  });
}

/** Sends one message and always settles, even if Termux:API stops responding. */
export function sendSms(number, message, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn('termux-sms-send', ['-n', number, message]);
    let stderr = '';
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      error ? reject(error) : resolve();
    };
    const timeout = setTimeout(() => {
      process.kill('SIGTERM');
      finish(new Error(`Tempo limite de ${Math.ceil(timeoutMs / 1000)}s excedido pelo Termux:API.`));
    }, timeoutMs);
    process.stderr.on('data', (data) => { stderr += data; });
    process.on('error', (error) => finish(error));
    process.on('close', (code) => finish(code === 0 ? null : new Error(stderr.trim() || `termux-sms-send terminou com código ${code}`)));
  });
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
