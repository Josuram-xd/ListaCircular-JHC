import type { DemoState } from './types'

export function demoState(names: string[], extra: Partial<DemoState> = {}): DemoState {
  const n = names.length
  return {
    list_id: 'd1',
    size: n,
    pointer: names[0] ?? null,
    nodes: names.map((name, i) => ({
      name,
      next: names[(i + 1) % n],
      prev: names[(i - 1 + n) % n],
      is_head: i === 0,
      is_pointer: i === 0,
    })),
    last_op: null,
    steps: [],
    highlight: [],
    ...extra,
  }
}
