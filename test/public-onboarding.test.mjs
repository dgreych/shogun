import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnvText } from '../dados/src/.scripts/instanceConfigStore.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const pkg = JSON.parse(read('package.json'));

async function setup(steps, { config, env = '' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shogun-onboarding-'));
  try {
    for (const file of ['dados/src/.scripts/config-panel.js','dados/src/.scripts/instanceConfigStore.js','dados/src/services/bunnyfy/instanceAccess.js','dados/src/services/bunnyfy/BunnyFyError.js','dados/src/utils/paths.js','dados/src/config.example.json','.env.example']) {
      const target = path.join(root, file); fs.mkdirSync(path.dirname(target), {recursive:true}); fs.copyFileSync(path.join(ROOT, file), target);
    }
    fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
    if (config) fs.writeFileSync(path.join(root,'dados/src/config.json'), JSON.stringify(config));
    fs.writeFileSync(path.join(root,'.env.local'), env);
    const child = spawn(process.execPath, [path.join(root,'dados/src/.scripts/config-panel.js')], {cwd:root,stdio:['pipe','pipe','pipe']});
    let output = ''; let index = 0; let position = 0;
    const result = await new Promise((resolve,reject) => {
      const timer = setTimeout(()=>{child.kill();reject(new Error('Onboarding não concluiu no prazo.'));},10000);
      child.on('error',error=>{clearTimeout(timer);reject(error);});
      child.stderr.on('data',chunk=>{output+=chunk;});
      child.stdout.on('data',chunk=>{
        output += chunk;
        const step = steps[index];
        if (step) {
          const at = output.indexOf(step.prompt, position);
          if (at !== -1) {position = at+step.prompt.length;index++;child.stdin.write(step.answer+'\n');}
        }
      });
      child.on('close',code=>{clearTimeout(timer);resolve({code,index});});
    });
    assert.equal(result.code,0,output);
    assert.equal(result.index,steps.length,'todas as perguntas esperadas foram respondidas');
    return {config:JSON.parse(fs.readFileSync(path.join(root,'dados/src/config.json'),'utf8')),env:parseEnvText(fs.readFileSync(path.join(root,'.env.local'),'utf8')),output};
  } finally {fs.rmSync(root,{recursive:true,force:true});}
}
const owner = '5511900000001', bot = '5511900000002';
const prompts = answers => ['Nome do bot','Número do dono com DDI e DDD','Número do bot com DDI e DDD','Chave BunnyFy (- para remover)'].map((prompt,i)=>({prompt,answer:answers[i]}));

test('setup e config abrem o mesmo onboarding atual de quatro campos', () => {
  assert.equal(pkg.scripts.setup, 'node dados/src/.scripts/config-panel.js');
  assert.equal(pkg.scripts.config, pkg.scripts.setup);
});
test('primeiro uso valida os números e salva integração gratuita sem exigir segredo', async () => {
  const steps=prompts(['Meu Shogun','123',bot,'']);
  steps.splice(2,0,{prompt:'Número do dono com DDI e DDD',answer:'+55 (11) 90000-0001'});
  const result=await setup(steps);
  assert.equal(result.config.nomebot,'Meu Shogun');
  assert.equal(result.config.numerodono,owner); assert.equal(result.config.numerobot,bot);
  assert.equal(result.config.prefixo,'!');
  assert.equal(result.env.get('DEFAULT_PERSONA'),'shogun');
  assert.equal(result.env.get('BUNNYFY_API_TOKEN'),'');
  assert.equal(result.env.get('BUNNYFY_ENABLED'),'true');
  assert.equal(result.env.get('BUNNYFY_BASE_URL'),'http://node1.vexhost.com.br:20056');
  assert.match(result.output,/Confira o valor/);
});
test('reconfiguração preserva prefixo, preferências, campos desconhecidos e chave atual', async () => {
  const config={nomebot:'Meu Shogun',nomedono:'Dono',numerodono:owner,numerobot:bot,prefixo:'/',preferencia:{menu:'custom'}};
  const result=await setup(prompts(['','','','']),{config,env:'# configuração humana\nCUSTOM_FLAG=abc\nBUNNYFY_API_TOKEN=onboarding-test-key\n'});
  assert.equal(result.config.prefixo,'/');assert.deepEqual(result.config.preferencia,{menu:'custom'});
  assert.equal(result.env.get('CUSTOM_FLAG'),'abc');
  assert.equal(result.env.get('BUNNYFY_API_TOKEN'),'onboarding-test-key');
  assert.equal(result.output.includes('onboarding-test-key'),false);
});
test('chave pode ser substituída ou removida sem aparecer no output', async () => {
  for(const key of ['onboarding-new-key','-']) {
    const result=await setup(prompts(['SHOGUN',owner,bot,key]),{env:'BUNNYFY_API_TOKEN=onboarding-old-key\n'});
    assert.equal(result.env.get('BUNNYFY_API_TOKEN'),key==='-'?'':key);
    assert.equal(result.output.includes('onboarding-new-key'),false);
    assert.equal(result.output.includes('onboarding-old-key'),false);
  }
});
test('guias explicam os quatro campos atuais e como conferir os requisitos', () => {
  for(const file of ['docs/instalacao/termux.md','docs/instalacao/linux.md']) {
    const guide=read(file);
    for(const field of [/nome do bot/i,/número do dono/i,/número do bot/i,/chave BunnyFy opcional/i,/npm run preflight/])assert.match(guide,field);
  }
});
