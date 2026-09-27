import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const slots = {
  menu: 'principal', menuprincipal: 'principal', help: 'principal', comandos: 'principal', commands: 'principal',
  alteradores: 'alteradores', menualterador: 'alteradores', menualteradores: 'alteradores', changersmenu: 'alteradores', changers: 'alteradores',
  ferramentas: 'ferramentas', menuferramentas: 'ferramentas', menuferramenta: 'ferramentas', toolsmenu: 'ferramentas', tools: 'ferramentas',
  menuadm: 'administracao', menuadmin: 'administracao', menuadmins: 'administracao', admmenu: 'administracao',
  menumembros: 'membros', menumemb: 'membros', menugeral: 'membros', membmenu: 'membros', membermenu: 'membros',
  menudono: 'dono', ownermenu: 'dono', menubrincadeiras: 'brincadeiras', menubrincadeira: 'brincadeiras', menubn: 'brincadeiras', gamemenu: 'brincadeiras',
  menudown: 'downloads', menudownload: 'downloads', menudownloads: 'downloads', downmenu: 'downloads', downloadmenu: 'downloads',
  menufig: 'figurinhas', menufigurinhas: 'figurinhas', menufigurinha: 'figurinhas', stickermenu: 'figurinhas', stickersmenu: 'figurinhas',
  menushogun: 'shogun', menulogo: 'logotipos', menulogos: 'logotipos', menurpg: 'rpg', menunexo: 'nexo', topcmd: 'atividade', topcmds: 'atividade',
  menulogotipos: 'logotipos',
};

export function resolveBrandMenuMedia(command) {
  const slot = slots[String(command).toLowerCase()];
  if (!slot) return null;
  const path = fileURLToPath(new URL(`../../../assets/brand/menus/${slot}.jpg`, import.meta.url));
  return fs.existsSync(path) ? { path, type: 'image', mimetype: 'image/jpeg', brand: true } : null;
}

export const brandMenuCommands = Object.freeze(Object.keys(slots));
