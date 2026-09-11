import fs from 'node:fs/promises';
import { paths } from '../utils/paths.js';
const defaults={defaultCountryCode:'258',delayMs:1000,maxRetries:0,showProgress:true,saveReports:true};
export async function loadConfig(){ try { return {...defaults,...JSON.parse(await fs.readFile(paths.config,'utf8'))}; } catch(e) { if(e.code==='ENOENT') return {...defaults,...JSON.parse(await fs.readFile(paths.configExample,'utf8'))}; throw new Error(`Configuração inválida: ${e.message}`); } }
export async function saveConfig(config){ if(!/^\d{1,3}$/.test(String(config.defaultCountryCode))) throw new Error('defaultCountryCode deve conter 1 a 3 dígitos.'); if(Number(config.delayMs)<1000) throw new Error('O delay mínimo é 1000 ms.'); await fs.writeFile(paths.config,JSON.stringify(config,null,2)+'\n'); }
