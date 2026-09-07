const pending = new WeakMap<HTMLElement, Promise<void>>();

export function renderDiagramsOnce(
  nodes: HTMLElement[],
  render: (nodes: HTMLElement[]) => Promise<void>,
  fontsReady: Promise<unknown>,
): Promise<void> {
  if (!nodes.length) return Promise.reject(new Error('No mounted diagrams to render'));
  const previous = pending.get(nodes[0]);
  if (previous) return previous;
  const task = fontsReady.then(() => render(nodes));
  pending.set(nodes[0], task);
  return task;
}
