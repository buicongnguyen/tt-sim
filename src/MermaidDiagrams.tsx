import { useEffect } from 'react';
import mermaid from 'mermaid';
import { renderDiagramsOnce } from './diagram-renderer';

// Effects run after React commits the chapter. Window load/rAF do not provide
// that guarantee. Share the pending render across StrictMode effect replays.
export default function MermaidDiagrams() {
  useEffect(() => {
    let active = true;
    document.documentElement.dataset.mermaid = 'loading';
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.mermaid'));
    void renderDiagramsOnce(nodes, nodes => mermaid.run({ nodes }), document.fonts.ready).then(() => {
      if (active) document.documentElement.dataset.mermaid = 'ready';
    }, error => {
      if (active) {
        document.documentElement.dataset.mermaid = 'failed';
        console.error('Mermaid rendering failed', error);
      }
    });
    return () => { active = false; };
  }, []);
  return null;
}
