import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryDiagnostic,createWhatsAppDeliveryLogger} from '../dados/src/utils/whatsappDeliveryLogger.js';
test('diagnóstico mantém falha e identificador sem conteúdo, contas ou chaves',()=>{
 const record=deliveryDiagnostic({msg:'error in sending message again',key:{remoteJid:'5522999999999@lid',id:'3EB0123456789ABC'},trace:'Error: No session for secret-account',privateKey:'secret',message:{text:'private text'},node:{content:'secret'}});
 assert.deepEqual(record,{event:'error in sending message again',addressType:'lid',id:'3EB0123456789ABC',reason:'missing-session'});
 assert.equal(deliveryDiagnostic({msg:'recv frame',node:{privateKey:'secret'}}),null);
});
test('logger registra pedido de reenvio, sem serializar os dados sensíveis',()=>{
 const logs=[];const logger=createWhatsAppDeliveryLogger(value=>logs.push(value));
 logger.debug({key:{remoteJid:'123456789@g.us',id:'3EB0123456789ABC'},attrs:{privateKey:'secret'}},'recv retry request');
 assert.deepEqual(logs,[{event:'recv retry request',addressType:'group',id:'3EB0123456789ABC'}]);
});
