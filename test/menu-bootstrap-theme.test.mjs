import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function databaseProbe(code) {
    const url = new URL('../dados/src/utils/database.js', import.meta.url).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import fs from 'node:fs';
        const { getMenuDesignWithDefaults } = await import(${JSON.stringify(url)});
        try {
            ${code}
            process.exit(0);
        } catch (error) {
            console.error(error);
            process.exit(1);
        }
    `], { encoding: 'utf8', timeout: 15000, stdio: 'pipe' });
}

test('configuração antiga não prevalece sobre o tema nem injeta linhas pelo nome', () => {
    databaseProbe(String.raw`
    const design = getMenuDesignWithDefaults('Outro nome', '*Fulano*\n!exec', '/', {
        header: 'DESENHO ANTIGO {userName}',
        menuItemIcon: 'FLORES',
        audioMenuTitle: 'MÚSICAS',
    });
    assert.match(design.header, /^╭━━━─〔 ⛩ SHOGUN 〕─━━━/u);
    assert.equal(design.header.includes('\n!exec'), false);
    assert.equal(design.header.includes('*Fulano*'), false);
    assert.equal(design.menuItemIcon, '  ▸ ');
    assert.equal(design.audioMenuTitle, 'MÚSICAS');
    assert.ok(design.header.includes('Prefixo › /'));
    `);
});

test('resolver desenho não regrava configurações persistentes', () => {
    databaseProbe(`
    const { MENU_DESIGN_FILE, CONFIG_FILE } = await import(${JSON.stringify(new URL('../dados/src/utils/paths.js', import.meta.url).href)});
    const candidates = [MENU_DESIGN_FILE, CONFIG_FILE].filter(Boolean);
    const before = candidates.map(file => {
        return [file, fs.existsSync(file) ? fs.readFileSync(file) : null];
    });
    getMenuDesignWithDefaults('SHOGUN', 'Maurício', '!', { header: 'ANTIGO' });
    for (const [url, content] of before) {
        assert.deepEqual(fs.existsSync(url) ? fs.readFileSync(url) : null, content);
    }
    `);
});

test('fontes CRLF geram runtime válido e o segundo preparo preserva o tema', () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const sourceRoot = process.env.SHOGUN_BOOT_BASELINE || root;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shogun-menu-boot-'));
    try {
        const scripts = path.join(temp, 'dados/src/.scripts');
        fs.cpSync(path.join(root, 'dados/src/.scripts'), scripts, {
            recursive: true,
            filter: file => !path.basename(file).startsWith('.runtime-'),
        });
        fs.cpSync(path.join(root, 'dados/src/menus'), path.join(temp, 'dados/src/menus'), { recursive: true });
        if (process.env.SHOGUN_BOOT_BASELINE) {
            for (const file of ['vnextMacrotrancheBridge.js', 'vnextDomainOwnershipOverlay.js', 'vnextMacrotrancheSeeds.json', 'vnextDomainCutoverPlan.json']) {
                fs.copyFileSync(path.join(sourceRoot, 'dados/src/.scripts', file), path.join(scripts, file));
            }
        }
        for (const file of ['dados/src/index.js', 'dados/src/connect.js', 'dados/src/funcs/private/ia.js', 'dados/src/.scripts/start.js']) {
            const target = path.join(temp, file);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, fs.readFileSync(path.join(sourceRoot, file), 'utf8').replace(/\r?\n/g, '\r\n'));
        }
        const prepareUrl = pathToFileURL(path.join(scripts, 'prepareRuntimeSources.js')).href;
        const finalizeUrl = pathToFileURL(path.join(scripts, 'finalizeShogunRuntime.js')).href;
        const criticalUrl = pathToFileURL(path.join(scripts, 'applyCriticalRuntimeFixes.js')).href;
        const menuUrl = pathToFileURL(path.join(temp, 'dados/src/menus/.runtime-menubn.js')).href;
        const probe = `
            import assert from 'node:assert/strict';
            import fs from 'node:fs';
            const { prepareRuntimeSources } = await import(${JSON.stringify(prepareUrl)});
            const { finalizeShogunRuntime } = await import(${JSON.stringify(finalizeUrl)});
            const { applyCriticalRuntimeFixes } = await import(${JSON.stringify(criticalUrl)});
            for (let attempt = 0; attempt < 2; attempt++) {
                prepareRuntimeSources();
                finalizeShogunRuntime();
                applyCriticalRuntimeFixes();
                const runtimeIndex = fs.readFileSync(${JSON.stringify(path.join(temp, 'dados/src/.runtime-index.js'))}, 'utf8');
                assert.ok(runtimeIndex.includes('*Maurício Almeida*'), 'o preparo deve preservar o cartão atual do criador');
                const { default: menu } = await import(${JSON.stringify(menuUrl)} + '?pass=' + attempt);
                const output = await menu('!', 'SHOGUN', 'Maurício', true);
                assert.match(output, /^╭━━━─〔 ⛩ SHOGUN 〕─━━━/u);
                assert.equal(output.includes('!nazista'), false);
                assert.equal(output.includes('!sexo'), false);
            }
        `;
        execFileSync(process.execPath, ['--input-type=module', '-e', probe], { cwd: temp, encoding: 'utf8', timeout: 30000, stdio: 'pipe' });
        for (const file of ['dados/src/.runtime-index.js', 'dados/src/.runtime-connect.js', 'dados/src/.scripts/.runtime-start.js']) {
            execFileSync(process.execPath, ['--check', path.join(temp, file)], { encoding: 'utf8', timeout: 15000, stdio: 'pipe' });
        }
    } finally {
        assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
        assert.ok(path.basename(temp).startsWith('shogun-menu-boot-'));
        fs.rmSync(temp, { recursive: true, force: true });
    }
});
