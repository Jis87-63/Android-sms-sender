import fs from 'node:fs/promises';
import path from 'node:path';

const PHONE_COLUMNS = ['numero', 'número', 'phone', 'telefone', 'mobile', 'contact'];
const NAME_COLUMNS = ['nome', 'name'];
// SheetJS reads these formats. `.slsx` is accepted for files that were renamed from XLSX.
export const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsm', '.xlsb', '.ods', '.slsx']);
export const CONTACT_EXTENSIONS = new Set(['.txt', '.csv', ...SPREADSHEET_EXTENSIONS]);

const key = (value) => String(value ?? '').trim().toLowerCase();

export function normalizeNumber(value, countryCode = '258') {
  let raw = String(value ?? '').trim();
  if (!raw) return null;
  const hadPlus = raw.startsWith('+');
  raw = raw.replace(/[^0-9]/g, '');
  if (!raw) return null;
  if (raw.startsWith('00')) raw = raw.slice(2);
  if (raw.startsWith(countryCode)) return `+${raw}`;
  if (raw.length === 9) return `+${countryCode}${raw}`;
  if (hadPlus && raw.length >= 8 && raw.length <= 15) return `+${raw}`;
  return null;
}

function fromRows(rows) {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0] || {});
  const phone = headers.find((header) => PHONE_COLUMNS.includes(key(header))) || (headers.length === 1 ? headers[0] : null);
  const name = headers.find((header) => NAME_COLUMNS.includes(key(header)));
  if (!phone) throw new Error('Não foi encontrada uma coluna de número reconhecida.');
  return rows.map((row) => ({ number: row[phone], name: name ? row[name] : '' }));
}

async function parseSpreadsheet(file) {
  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch {
    throw new Error('O suporte a Excel/planilhas requer a dependência xlsx. Execute npm install.');
  }
  try {
    const workbook = XLSX.readFile(file);
    if (!workbook.SheetNames.length) throw new Error('A planilha não contém folhas.');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return fromRows(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
  } catch (cause) {
    throw new Error(`Não foi possível ler a planilha ${path.basename(file)}: ${cause.message}`);
  }
}

export async function parseContactFile(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.txt') {
    return (await fs.readFile(file, 'utf8')).split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((number) => ({ number, name: '' }));
  }
  if (extension === '.csv') {
    const text = await fs.readFile(file, 'utf8');
    const lines = text.trim().split(/\r?\n/);
    if (!lines[0]) return [];
    const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const columns = lines.shift().split(delimiter).map((column) => column.trim());
    return fromRows(lines.filter(Boolean).map((line) => Object.fromEntries(columns.map((column, index) => [column, line.split(delimiter)[index]?.trim() ?? '']))));
  }
  if (SPREADSHEET_EXTENSIONS.has(extension)) return parseSpreadsheet(file);
  throw new Error(`Formato não suportado: ${extension || '(sem extensão)'}`);
}

export async function listContactFiles(directory) {
  return (await fs.readdir(directory)).filter((file) => CONTACT_EXTENSIONS.has(path.extname(file).toLowerCase())).sort();
}

export async function buildRecipients(files, config, blacklist = new Set()) {
  const all = [];
  for (const file of files) all.push(...await parseContactFile(file));
  const invalid = [];
  const duplicate = [];
  const recipients = [];
  const seen = new Set();
  for (const item of all) {
    const number = normalizeNumber(item.number, config.defaultCountryCode);
    if (!number) { invalid.push(item); continue; }
    if (seen.has(number)) { duplicate.push(item); continue; }
    seen.add(number);
    if (!blacklist.has(number)) recipients.push({ number, name: String(item.name || '').trim() });
  }
  return { total: all.length, invalid, duplicate, blacklisted: [...seen].filter((number) => blacklist.has(number)), recipients };
}
