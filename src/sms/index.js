import { spawn } from 'node:child_process';
export function hasSmsCommand(){return new Promise(resolve=>{const p=spawn('sh',['-lc','command -v termux-sms-send'],{stdio:'ignore'});p.on('close',c=>resolve(c===0));p.on('error',()=>resolve(false));});}
export function sendSms(number,message){return new Promise((resolve,reject)=>{const p=spawn('termux-sms-send',['-n',number,message]);let error='';p.stderr.on('data',d=>error+=d);p.on('error',e=>reject(e));p.on('close',code=>code===0?resolve():reject(new Error(error.trim()||`termux-sms-send terminou com código ${code}`)));});}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
