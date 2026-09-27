import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInstagramDownload } from './contracts.js';
import { instagramDownloadWithBunnyFy } from './capabilityGateway.js';
const item=(type,n)=>({type,media:{mediaId:'media_valid_'+n,mediaUrl:'/v1/media/media_valid_'+n,mime:type==='image'?'image/jpeg':'video/mp4',bytes:3}});
const env={BUNNYFY_ENABLED:'true',BUNNYFY_INSTAGRAM_MODE:'exclusive'};
test('Instagram mantém todas as mídias do carrossel, na ordem',async()=>{
 const items=parseInstagramDownload({items:[item('image',1),item('video',2)]}).items;
 const seen=[];
 const result=await instagramDownloadWithBunnyFy('https://www.instagram.com/p/Example123/',{env,clientFactory:()=>({downloadInstagram:async()=>({items}),downloadMedia:async media=>{seen.push(media.mediaId);return {buffer:Buffer.from('abc'),mime:media.mime};}})});
 assert.deepEqual(result.data.map(i=>i.type),['image','video']);assert.deepEqual(seen,['media_valid_1','media_valid_2']);assert.equal(result.count,2);
});
test('Instagram rejeita conteúdo vazio, tipo divergente e mais de vinte itens',()=>{
 for(const items of [[],[item('audio',1)],[{...item('image',1),media:item('video',1).media}],Array.from({length:21},(_,i)=>item('image',i))])assert.throws(()=>parseInstagramDownload({items}));
});
test('Instagram não devolve sucesso parcial nem contorna limite da API',async()=>{
 let fallback=0,calls=0;
 await assert.rejects(()=>instagramDownloadWithBunnyFy('url',{env,legacyFallback:async()=>fallback++,clientFactory:()=>({downloadInstagram:async()=>({items:[item('image',1),item('video',2)]}),downloadMedia:async()=>{if(++calls===2)throw new Error('falha');return {buffer:Buffer.from('abc'),mime:'image/jpeg'};}})}));
 assert.equal(fallback,0);assert.equal(calls,2);
 await assert.rejects(()=>instagramDownloadWithBunnyFy('url',{env,clientFactory:()=>({downloadInstagram:async()=>{throw Object.assign(new Error('limite'),{status:429});}})}));
});
