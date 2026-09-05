import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import postcss from 'postcss';

const source = await readFile(new URL('../scripts/dark-theme.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { default: darkTheme, darkColor } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('every published chapter initializes its preference before app scripts', async () => {
  const dist = new URL('../dist/', import.meta.url);
  for (const file of await readdir(dist)) {
    if (!file.endsWith('.html')) continue;
    const html = await readFile(new URL(file, dist), 'utf8');
    assert.match(html, /<script src="\.\/theme-init.js"><\/script>/, file);
    assert.ok(html.indexOf('theme-init.js') < html.indexOf('type="module"'), file);
  }
});

test('preference bootstrap handles stored, system, malformed and blocked storage', async () => {
  const init = await readFile(new URL('../public/theme-init.js', import.meta.url), 'utf8');
  for (const [saved, system, expected] of [['dark', false, 'dark'], ['light', true, 'light'], [null, true, 'dark'], ['bad', false, 'light'], ['throws', true, 'dark']]) {
    const document = { documentElement: { dataset: {}, style: {} } };
    runInNewContext(init, { document, matchMedia: () => ({ matches: system }), localStorage: { getItem: () => { if (saved === 'throws') throw Error(); return saved; } } });
    assert.equal(document.documentElement.dataset.theme, expected);
    assert.equal(document.documentElement.style.colorScheme, expected);
  }
});

test('dark variants cover literal colors, reversed tokens, gradients and responsive states', async () => {
  const css = ':root{--ink:#111;--paper:#fff}.card{background:var(--paper);color:var(--ink);border:1px solid #ddd}.reverse{background:var(--ink);color:var(--paper)}@media(max-width:600px){.tab:hover{background:linear-gradient(#fff,rgba(255,255,255,.8));color:black}}';
  const result = await postcss([darkTheme()]).process(css, { from: 'C:/repo/src/example.css' });
  assert.match(result.css, /:root\[data-theme="dark"\] \.card/);
  assert.match(result.css, /:root\[data-theme="dark"\] \.reverse/);
  assert.match(result.css, /@media[^]*:root\[data-theme="dark"\] \.tab:hover/);
  assert.ok(result.css.includes(darkColor('#fff', 'surface')));
  assert.ok(result.css.includes(darkColor('#111', 'text')));
  assert.ok(result.css.includes('.reverse{background:var(--ink);color:var(--paper)}'));
});

test('all authored chapter styles get dark rules without unresolved color variables', async () => {
  const dir = new URL('../src/', import.meta.url);
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.css')) continue;
    const css = await readFile(new URL(file, dir), 'utf8');
    const result = await postcss([darkTheme()]).process(css, { from: `C:/repo/src/${file}` });
    let generated = 0;
    result.root.walkRules(rule => {
      if (!rule.selector.includes('data-theme="dark"')) return;
      generated++;
      rule.walkDecls(decl => {
        if (/^(color|background|background-color)$/.test(decl.prop)) assert.ok(!decl.value.includes('var('), `${file}: ${decl.toString()}`);
      });
    });
    assert.ok(generated > 5, file);
  }
});
