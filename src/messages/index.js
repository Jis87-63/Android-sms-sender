import fs from 'node:fs/promises'; import path from 'node:path';
export async function listMessages(dir){return (await fs.readdir(dir)).filter(f=>path.extname(f).toLowerCase()==='.txt').sort();}
export async function readMessage(file){const m=await fs.readFile(file,'utf8');if(!m.trim())throw new Error('A mensagem está vazia.');return m.trim();}
export function renderMessage(template,contact,{index,total,now=new Date()}={}){const date=now.toISOString().slice(0,10),time=now.toTimeString().slice(0,8);const vars={numero:contact.number,nome:contact.name||contact.number,data:date,hora:time,indice:index,total};return template.replace(/\{(numero|nome|data|hora|indice|total)\}/g,(_,k)=>String(vars[k]??''));}
