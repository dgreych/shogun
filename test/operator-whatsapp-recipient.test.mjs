import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOperatorRecipient } from '../dados/src/utils/operatorWhatsAppRecipient.js';
test('envio privado usa o endereço LID devolvido pelo WhatsApp e renova a sessão',async()=>{
 const calls=[];const socket={onWhatsApp:async number=>{assert.equal(number,'5522997028553');return [{exists:true,jid:'552297028553@s.whatsapp.net',lid:'123456789@lid'}];},assertSessions:async (...args)=>calls.push(args)};
 assert.equal(await resolveOperatorRecipient(socket,'5522997028553'),'123456789@lid');assert.deepEqual(calls,[[['123456789@lid'],true]]);
});
test('sem LID usa o telefone normalizado pelo WhatsApp e recusa conta inexistente',async()=>{
 assert.equal(await resolveOperatorRecipient({onWhatsApp:async()=>[{exists:true,jid:'552297028553@s.whatsapp.net'}]},'5522997028553'),'552297028553@s.whatsapp.net');
 await assert.rejects(resolveOperatorRecipient({onWhatsApp:async()=>[]},'5522997028553'),/localizar/);
});
