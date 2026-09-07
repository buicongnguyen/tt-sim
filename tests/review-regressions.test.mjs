import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import postcss from 'postcss';

test('diagram rendering waits for fonts and runs once per mounted node set', async () => {
  const source = await readFile(new URL('../src/diagram-renderer.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { renderDiagramsOnce } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  let release;
  const fonts = new Promise(resolve => { release = resolve; });
  const nodes = [{}];
  let calls = 0;
  const render = async received => { assert.equal(received, nodes); calls++; };
  const first = renderDiagramsOnce(nodes, render, fonts);
  const replay = renderDiagramsOnce(nodes, render, fonts);
  assert.equal(first, replay);
  assert.equal(calls, 0);
  release();
  await Promise.all([first, replay]);
  assert.equal(calls, 1);
  await assert.rejects(renderDiagramsOnce([], render, Promise.resolve()), /No mounted diagrams/);
  const failure = Error('invalid diagram');
  await assert.rejects(renderDiagramsOnce([{}], async () => { throw failure; }, Promise.resolve()), failure);
});

test('Q&A search includes numbered reasoning and source labels', async () => {
  const source = await readFile(new URL('../src/qa-search.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
  const { matchesQA } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  const item = { question: 'Test', answer: '', deeper: '', proof: '', memory: '', category: '',
    steps: [{ keyword: 'Baseline', explanation: 'Preserve the architecture descriptor' }],
    sources: [{ label: 'Library ABI', href: 'https://example.com' }] };
  for (const query of ['baseline', '  ARCHITECTURE DESCRIPTOR ', 'library abi', '  ']) assert.ok(matchesQA(item, query), query);
  assert.equal(matchesQA(item, 'missing phrase'), false);
  assert.equal(matchesQA({ ...item, steps: undefined }, 'baseline'), false);
});

test('reading-scale rules do not change Mermaid label metrics', async () => {
  const css = postcss.parse(await readFile(new URL('../src/reading.css', import.meta.url), 'utf8'));
  css.walkRules(rule => {
    // Mermaid uses HTML div/span/p labels inside measured SVG foreignObjects.
    if ((rule.selector.startsWith('#root :where(p,') || rule.selector.startsWith('#root :where(div,')) && rule.nodes.some(node => node.type === 'decl' && node.prop === 'font-size')) {
      assert.ok(rule.selector.includes(':not(:where(.mermaid,.mermaid *))'), rule.selector);
    }
  });
});

test('home reading progress observes content size and releases the observer', async () => {
  const source = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(source, /new ResizeObserver\(updateProgress\)/);
  assert.match(source, /contentResize\.observe\(document\.querySelector\('main'\)!\)/);
  assert.match(source, /contentResize\.disconnect\(\)/);
});
