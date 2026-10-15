import { API_URL } from '../api'
import type { DemoOp, DemoState } from './types'

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Error ${res.status}`
    try {
      const j = await res.json()
      if (typeof j.detail === 'string') detail = j.detail
      else if (Array.isArray(j.detail)) detail = j.detail.map((d: { msg?: string }) => d.msg).join(', ')
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

const root = (base: string) => base.replace(/\/$/, '')

export async function createDemoList(names: string[] = [], base: string = API_URL): Promise<DemoState> {
  const res = await fetch(`${root(base)}/demo/lists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ names }),
  })
  const data = await parse<{ list_id: string; state: DemoState }>(res)
  return data.state
}

export async function demoOp(listId: string, op: DemoOp, base: string = API_URL): Promise<DemoState> {
  const res = await fetch(`${root(base)}/demo/lists/${encodeURIComponent(listId)}/ops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op),
  })
  return parse<DemoState>(res)
}
