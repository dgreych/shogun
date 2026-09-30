import test from 'node:test';
import assert from 'node:assert/strict';
import menus from '../dados/src/menus/index.js';
import {createShogunMenuTheme} from '../dados/src/menus/theme.js';
test('designmenu controla cabeçalho, bordas, itens, títulos e separadores em todos os menus',async()=>{
 const options={...createShogunMenuTheme(),header:'SHOGUN #title# · #nome# · #prefix#',menuTopBorder:'TOPO',middleBorder:'MEIO',bottomBorder:'FIM',menuItemIcon:' ITEM ',menuTitleIcon:'TÍTULO ',separatorIcon:'SEÇÃO'};
 for(const [name,render]of Object.entries(menus)){
  const args=name==='menubn'?['!','SHOGUN','Fulano',false,options]:name==='menuTopCmd'?['!','SHOGUN','Fulano',[],options]:['!','SHOGUN','Fulano',options];
  const output=await render(...args);
  assert.match(output,/^SHOGUN TÍTULO /,name);assert.ok(output.includes('Fulano · !'),name);
  assert.ok(output.includes('TOPO 01 SEÇÃO'),name);assert.ok(output.includes('MEIO ITEM *!'),name);assert.ok(output.endsWith('FIM'),name);
 }
});
test('desenho personalizado preserva filtro de permissões e categorias vazias não aparecem',async()=>{
 const options={...createShogunMenuTheme(),menuItemIcon:' -> ',accessFor:command=>({visible:command==='menudown',executable:true})};
 const output=await menus.menu('!','SHOGUN','Fulano',options);
 assert.ok(output.includes('│ -> *!menudown*'));assert.equal(output.includes('!menudono'),false);
 assert.equal(output.includes('ADMINISTRAÇÃO'),false);assert.equal(output.includes('JOGOS'),false);
});
