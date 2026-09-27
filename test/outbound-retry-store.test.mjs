import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { OutboundRetryStore } from '../dados/src/utils/outboundRetryStore.js';
test('reenvio recupera o conteúdo original com chave de mídia após reiniciar', t => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'shogun-retry-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'retry.json'),key={remoteJid:'5522997028553@s.whatsapp.net',id:'message-1',fromMe:true};
 const store=new OutboundRetryStore({file,now:()=>100});
 store.put({key,message:{imageMessage:{caption:'Shogun',mediaKey:Buffer.from([1,2,3]),mimetype:'image/jpeg'}}});
 const restored=new OutboundRetryStore({file,now:()=>200});
 const message=restored.get(key);assert.equal(message.imageMessage.caption,'Shogun');assert.deepEqual(Buffer.from(message.imageMessage.mediaKey),Buffer.from([1,2,3]));
 assert.equal(restored.get({...key,remoteJid:'outro@g.us'}),undefined);
});
test('cache de reenvio ignora mensagens recebidas, limita tamanho e expira',()=>{
 let now=100;const store=new OutboundRetryStore({now:()=>now,maxEntries:2,ttlMs:100,save:()=>{}});
 const outgoing=id=>({key:{remoteJid:'123@g.us',id,fromMe:true},message:{conversation:id}});
 store.put({...outgoing('incoming'),key:{...outgoing('incoming').key,fromMe:false}});
 assert.equal(store.get(outgoing('incoming').key),undefined);
 for(const id of ['1','2','3'])store.put(outgoing(id));
 assert.equal(store.get(outgoing('1').key),undefined);assert.equal(store.get(outgoing('3').key).conversation,'3');
 now+=101;assert.equal(store.get(outgoing('3').key),undefined);
});

test('hidetag com mil membros conserva imagem e legenda para reenvio',()=>{
 const store=new OutboundRetryStore({save:()=>{}});
 const key={remoteJid:'123@g.us',id:'large-group',fromMe:true};
 const mentionedJid=Array.from({length:1000},(_,i)=>`${5500000000000+i}@s.whatsapp.net`);
 assert.equal(store.put({key,message:{imageMessage:{caption:'Shogun · Nova geração',mediaKey:Buffer.from([1,2,3]),contextInfo:{mentionedJid}}}}),true);
 assert.deepEqual(store.get(key).imageMessage.contextInfo.mentionedJid,mentionedJid);
 assert.equal(store.get(key).imageMessage.caption,'Shogun · Nova geração');
 assert.equal(store.put({key:{...key,id:'oversized'},message:{conversation:'x'.repeat(65*1024)}}),false);
});
