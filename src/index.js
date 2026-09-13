import readline from 'node:readline/promises';
import path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { paths } from './utils/paths.js';
import { loadConfig, saveConfig } from './config/index.js';
import { listContactFiles, buildRecipients, normalizeNumber } from './contacts/index.js';
import { loadBlacklist, saveBlacklist } from './blacklist.js';
import { listMessages, readMessage, renderMessage } from './messages/index.js';
import { hasSmsCommand } from './sms/index.js';
import { runCampaign } from './campaign.js';
import { listReports } from './reports/index.js';

const rl = readline.createInterface({ input, output });
const ask = (question) => rl.question(question);
const write = (text = '') => console.log(text);
const clear = () => { if (output.isTTY) output.write('\x1b[2J\x1b[H'); };
const duration = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');
};
const border = '╭──────────────────────────────────────────╮';
const footer = '╰──────────────────────────────────────────╯';
function panel(rows) {
  write(border);
  for (const row of rows) write(`│ ${String(row).padEnd(40).slice(0, 40)} │`);
  write(footer);
}
function progressView(state, controls, mode) {
  const percentage = state.total ? Math.round((state.processed / state.total) * 100) : 0;
  const filled = Math.round(percentage / 5);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(20 - filled)}`;
  const elapsed = Date.now() - state.startedAt;
  const rate = state.processed / Math.max(elapsed / 1000, 1);
  const eta = state.processed ? ((state.total - state.processed) / rate) * 1000 : 0;
  clear();
  panel([
    '             SMS SENDER PRO',
    mode === 'dry-run' ? '          MODO TESTE / DRY RUN' : '       ENVIO VIA TERMUX:API + SIM',
    '──────────────────────────────────────────',
    `  ${bar} ${String(percentage).padStart(3)}%`,
    `  Processados: ${state.processed}/${state.total}`,
    `  Sucessos: ${state.success}       Falhas: ${state.failed}`,
    `  Pendentes: ${state.total - state.processed}`,
    `  Velocidade: ~${rate.toFixed(1)} SMS/seg`,
    `  Decorrido: ${duration(elapsed)}  Estimado: ${duration(eta)}`,
    `  Último: ${state.status === 'success' ? '✓' : '✗'} ${state.last || '—'}`,
    controls.paused ? '  STATUS: PAUSADO' : '  STATUS: EM ENVIO',
    '──────────────────────────────────────────',
    '  [P] Pausar  [R] Retomar  [Q] Parar'
  ]);
}
async function choose(items, title, multiple = false) {
  if (!items.length) { write(`\nNenhum ficheiro em ${title}.`); return []; }
  write(`\n${title.toUpperCase()}`);
  items.forEach((item, index) => write(` ${index + 1}. ${item}`));
  if (multiple) write(' A. Selecionar todas');
  const answer = (await ask('Seleção (números separados por vírgula): ')).trim().toLowerCase();
  if (multiple && answer === 'a') return items;
  if (!multiple) return items[Number(answer) - 1] ? [items[Number(answer) - 1]] : [];
  return [...new Set(answer.split(',').map((number) => items[Number(number.trim()) - 1]).filter(Boolean))];
}
async function runFromMenu(config) {
  const files = await choose(await listContactFiles(paths.contacts), 'Contactos', true);
  if (!files.length) return;
  const blacklist = await loadBlacklist(paths.blacklist, config.defaultCountryCode);
  const built = await buildRecipients(files.map((file) => path.join(paths.contacts, file)), config, blacklist);
  panel(['RESUMO DA CAMPANHA', `Listas: ${files.join(', ')}`, `Contactos encontrados: ${built.total}`, `Duplicados removidos: ${built.duplicate.length}`, `Números inválidos: ${built.invalid.length}`, `Blacklist: ${built.blacklisted.length}`, `Total elegível: ${built.recipients.length}`]);
  if (!built.recipients.length) return;
  const selection = await choose(await listMessages(paths.messages), 'Mensagens');
  if (!selection.length) return;
  const template = await readMessage(path.join(paths.messages, selection[0]));
  write('\nPRÉ-VISUALIZAÇÃO (primeiros 5)');
  built.recipients.slice(0, 5).forEach((contact, index) => write(`\n${index + 1}. ${contact.number}\n${renderMessage(template, contact, { index: index + 1, total: built.recipients.length })}`));
  write('\nAÇÃO DA CAMPANHA');
  write(' [S] Simular/Testar — não envia nenhum SMS');
  write(' [E] Envio real — requer confirmação escrita');
  write(' [N] Cancelar');
  const action = (await ask('Escolha [S/E/N]: ')).trim().toLowerCase();
  if (action === 'n' || !action) return;
  if (!['s', 'e'].includes(action)) { write('Opção inválida. Nenhuma mensagem foi enviada.'); return; }
  const dryRun = action === 's';
  if (!dryRun && !await hasSmsCommand()) { write('\nTermux:API indisponível. Instale a app Termux:API e execute: pkg install termux-api'); return; }
  if (dryRun) {
    if ((await ask('\nGerar relatório de teste (sem enviar SMS)? [s/N]: ')).trim().toLowerCase() !== 's') return;
    write('\nModo teste confirmado: nenhum SMS será enviado.');
  } else {
    const confirmation = await ask('\nATENÇÃO: para iniciar o envio real, escreva ENVIAR: ');
    if (confirmation.trim().toUpperCase() !== 'ENVIAR') { write('Envio real cancelado. Nenhuma mensagem foi enviada.'); return; }
  }

  const controls = { reports: paths.reports, paused: false, cancelled: false };
  let confirmStop = false;
  let current = { processed: 0, total: built.recipients.length, success: 0, failed: 0, last: '—', status: 'success', startedAt: Date.now() };
  const render = () => progressView(current, controls, dryRun ? 'dry-run' : 'send');
  const keyboard = (chunk) => {
    const key = String(chunk).toLowerCase();
    if (key === 'p') controls.paused = true;
    if (key === 'r') { controls.paused = false; confirmStop = false; }
    if (key === 'q') { controls.cancelled = confirmStop; confirmStop = !confirmStop; }
    render();
    if (confirmStop && !controls.cancelled) write('\nPressione [Q] novamente para confirmar a paragem; [R] para continuar.');
  };
  if (input.isTTY) { input.setRawMode(true); input.on('data', keyboard); }
  try {
    render();
    const result = await runCampaign({ recipients: built.recipients, template, config, dryRun, controls, onProgress: (state) => { current = state; render(); } });
    clear();
    panel([result.cancelled ? 'CAMPANHA INTERROMPIDA' : 'CAMPANHA CONCLUÍDA', `Sucessos: ${result.success}`, `Falhas: ${result.failed}`, `Relatório: ${result.reportDir || 'desativado'}`]);
  } finally {
    if (input.isTTY) { input.off('data', keyboard); input.setRawMode(false); }
  }
}
async function blacklistMenu(config) {
  const set = await loadBlacklist(paths.blacklist, config.defaultCountryCode);
  write(`\nBlacklist (${set.size}):\n${[...set].join('\n') || '(vazia)'}`);
  const action = (await ask('\n[A]dicionar, [R]emover, [L]impar, Enter voltar: ')).trim().toLowerCase();
  if (action === 'a') { const n = normalizeNumber(await ask('Número: '), config.defaultCountryCode); if (n) { set.add(n); await saveBlacklist(paths.blacklist, set); } }
  if (action === 'r') { set.delete(normalizeNumber(await ask('Número: '), config.defaultCountryCode)); await saveBlacklist(paths.blacklist, set); }
  if (action === 'l' && (await ask('Confirmar limpeza [s/N]: ')).toLowerCase() === 's') await saveBlacklist(paths.blacklist, new Set());
}
async function main() {
  let config = await loadConfig();
  while (true) {
    const [contacts, messages, blacklist, api] = await Promise.all([listContactFiles(paths.contacts), listMessages(paths.messages), loadBlacklist(paths.blacklist, config.defaultCountryCode), hasSmsCommand()]);
    clear();
    panel(['             SMS SENDER PRO', '       TERMUX SMS MANAGEMENT', '──────────────────────────────────────────', `API: ${api ? '✓ Termux:API disponível' : '✗ Termux:API indisponível'}`, `Listas: ${contacts.length}   Mensagens: ${messages.length}   Blacklist: ${blacklist.size}`, '──────────────────────────────────────────', '1  Enviar SMS', '2  Blacklist', '3  Configurações', '4  Relatórios', '5  Diagnóstico', '6  Informações do proprietário', '0  Sair']);
    const choice = await ask('Opção: ');
    if (choice === '0') break;
    if (choice === '1') await runFromMenu(config);
    if (choice === '2') await blacklistMenu(config);
    if (choice === '3') { const delay = await ask(`Delay atual ${config.delayMs}ms (mín. 1000): `); if (delay) { config.delayMs = Number(delay); try { await saveConfig(config); write('Configuração guardada.'); } catch (error) { write(error.message); config = await loadConfig(); } } }
    if (choice === '4') { const reports = await listReports(paths.reports); write(`\nCampanhas: ${reports.length}\n${reports.join('\n') || 'Sem relatórios.'}`); await ask('Enter para voltar.'); }
    if (choice === '5') await import('./doctor.js');
    if (choice === '6') await import('./owner.js');
  }
  rl.close();
}
main().catch((error) => { console.error(`\nErro: ${error.message}`); rl.close(); process.exitCode = 1; });
