import type { Plugin } from 'postcss';

// Legacy chapters use the same token as both ink and a reversed panel surface.
// Resolve colors by their *property*, rather than reversing tokens globally.
// This keeps every existing selector, state and responsive rule in the theme.
export function darkColor(value: string, role: 'text' | 'surface' | 'border'): string {
  // Consume URLs and quoted strings intact before matching color tokens.
  // Otherwise url('/black.svg#fff') would be rewritten as a broken URL.
  return value.replace(/url\((?:[^()"']|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[\da-f]{3,8}\b|rgba?\([^()]+\)|\b(?:white|black)\b/gi, (color) => {
    if (/^url\(/i.test(color) || color.startsWith('"') || color.startsWith("'")) return color;
    let channels: number[];
    let alpha = 1;
    if (color.startsWith('#')) {
      let hex = color.slice(1);
      if (hex.length === 3 || hex.length === 4) hex = hex.split('').map(c => c + c).join('');
      channels = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
      if (hex.length === 8) alpha = parseInt(hex.slice(6), 16) / 255;
    } else if (/^rgba?/i.test(color)) {
      const values = color.match(/[\d.]+%?/g)!;
      channels = values.slice(0, 3).map(v => parseFloat(v) * (v.endsWith('%') ? 2.55 : 1));
      if (values[3]) alpha = parseFloat(values[3]) / (values[3].endsWith('%') ? 100 : 1);
    } else channels = color.toLowerCase() === 'white' ? [255, 255, 255] : [0, 0, 0];
    const spread = Math.max(...channels) - Math.min(...channels);
    const base = role === 'surface' ? [16, 23, 30] : role === 'border' ? [55, 70, 81] : [205, 217, 225];
    const weight = role === 'surface' ? 0.075 : role === 'border' ? 0.08 : spread > 45 ? 0.3 : 0.08;
    const mapped = channels.map((c, i) => Math.min(255, Math.round(base[i] + c * weight)));
    return `rgba(${mapped.join(',')},${alpha})`;
  });
}

export default function darkTheme(): Plugin {
  return {
    postcssPlugin: 'ttsim-complete-dark-theme',
    Once(root) {
      // Only authored chapter CSS, never vendor styles or generated SVG styles.
      if (!/[\\/]src[\\/].*\.css$/.test(root.source?.input.file ?? '')) return;
      const globals = new Map<string, string>();
      root.walkRules(rule => {
        if (rule.selector === ':root' || rule.selector === '.book-frame') {
          rule.walkDecls(/^--/, decl => { globals.set(decl.prop, decl.value); });
        }
      });
      const rules: Parameters<Parameters<typeof root.walkRules>[0]>[0][] = [];
      root.walkRules(rule => { rules.push(rule); });
      for (const rule of rules) {
        if (rule.selector.includes('data-theme') || rule.parent?.type === 'atrule' && /keyframes$/.test(rule.parent.name)) continue;
        const variables = new Map(globals);
        rule.walkDecls(/^--/, decl => { variables.set(decl.prop, decl.value); });
        const resolve = (value: string): string => {
          for (let i = 0; i < 8 && value.includes('var('); i++) {
            const next = value.replace(/var\((--[\w-]+)\)/g, (match, name) => variables.get(name) ?? match);
            if (next === value) break;
            value = next;
          }
          return value;
        };
        const override = rule.clone({ nodes: [] });
        override.selectors = rule.selectors.map(selector => selector.startsWith(':root')
          ? selector.replace(':root', ':root[data-theme="dark"]')
          : selector.startsWith('html') ? selector.replace(/^html/, 'html[data-theme="dark"]')
          : `:root[data-theme="dark"] ${selector}`);
        rule.walkDecls(decl => {
          if (decl.prop.startsWith('--')) return;
          const role = /^(color|fill|stroke|caret-color|accent-color|text-decoration-color)$/.test(decl.prop) ? 'text'
            : /^background/.test(decl.prop) ? 'surface'
            : /^(border|outline|box-shadow|text-shadow)/.test(decl.prop) ? 'border' : null;
          if (!role) return;
          const resolved = resolve(decl.value);
          const value = darkColor(resolved, role);
          if (value !== resolved) override.append(decl.clone({ value }));
        });
        if (override.nodes.length) rule.after(override);
      }
    },
  };
}
