import test from 'node:test';
import assert from 'node:assert/strict';
import {PromotionQueue} from '../dados/src/utils/promotionQueue.js';
test('grupos excluídos permanecem fora ao iniciar e repetir uma campanha',()=>{
 const state={nextId:2,messages:[{id:1,text:'Shogun'}],campaign:null,excludedGroups:['1@g.us']};
 const queue=new PromotionQueue({load:()=>state,save:()=>{},now:()=>100});
 assert.equal(queue.start(1,['1@g.us','2@g.us']).total,1);
 assert.deepEqual(state.campaign.targets,['2@g.us']);
 queue.pause();queue.restart(['1@g.us','2@g.us']);
 assert.deepEqual(state.campaign.targets,['2@g.us']);
 state.campaign.results={'1@g.us':'sent'};
 assert.deepEqual(queue.progress(),{id:1,status:'paused',total:1,sent:0,failed:0,uncertain:0,pending:1});
});
