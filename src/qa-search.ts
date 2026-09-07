import type { QAItem } from './architecture-interview-qa-data';

export function matchesQA(item: QAItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  const text = [item.question, item.answer, item.deeper, item.proof, item.memory,
    item.category, ...(item.steps ?? []).flatMap(step => [step.keyword, step.explanation]),
    ...item.sources.map(source => source.label)].join(' ').toLowerCase();
  return !needle || text.includes(needle);
}
