import fs from 'node:fs/promises'; import { normalizeNumber } from './contacts/index.js';
export async function loadBlacklist(file,countryCode){try{const data=await fs.readFile(file,'utf8');return new Set(data.split(/\r?\n/).filter(x=>x.trim()&&!x.trim().startsWith('#')).map(x=>normalizeNumber(x,countryCode)).filter(Boolean));}catch(e){if(e.code==='ENOENT')return new Set();throw e;}}
export async function saveBlacklist(file,items){await fs.writeFile(file,[...items].sort().join('\n')+'\n');}
