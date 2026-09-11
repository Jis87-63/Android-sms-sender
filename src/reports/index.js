import fs from 'node:fs/promises'; import path from 'node:path';
const esc=v=>'"'+String(v??'').replaceAll('"','""')+'"';
export function campaignId(now=new Date()){return now.toISOString().replace('T','_').replace(/[:.]/g,'-').slice(0,19);}
export async function createReport(base,meta={}){const dir=path.join(base,campaignId());await fs.mkdir(dir,{recursive:true});const report={...meta,createdAt:new Date().toISOString(),results:[]};await persist(dir,report);return {dir,report};}
async function persist(dir,report){await fs.writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2));for(const status of ['success','failed','pending']){const rows=report.results.filter(r=>r.status===status);const header='numero,nome,status,data,hora,mensagem,erro,indice\n';const body=rows.map(r=>[r.number,r.name,r.status,r.date,r.time,r.message,r.error,r.index].map(esc).join(',')).join('\n');await fs.writeFile(path.join(dir,`${status}.csv`),header+body+(body?'\n':''));}}
export async function recordReport(ctx,result){ctx.report.results.push(result);await persist(ctx.dir,ctx.report);}
export async function listReports(base){return (await fs.readdir(base,{withFileTypes:true})).filter(x=>x.isDirectory()).map(x=>x.name).sort().reverse();}
