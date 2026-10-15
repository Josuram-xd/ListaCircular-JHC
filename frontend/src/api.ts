export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

export function wsUrl(gameId: string, base: string = API_URL): string {
  return base.replace(/^http/, 'ws').replace(/\/$/, '') + `/ws/games/${gameId}`
}

export async function createGame(bots: number, chips: number, base: string = API_URL): Promise<string> {
  const res = await fetch(`${base.replace(/\/$/, '')}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bots, chips }),
  })
  if (!res.ok) {
    let detail = `Error ${res.status}`
    try {
      const j = await res.json()
      if (typeof j.detail === 'string') detail = j.detail
      else if (Array.isArray(j.detail)) detail = j.detail.map((d: { msg?: string }) => d.msg).join(', ')
    } catch { /* ignore */ }
    throw new Error(detail)
  }
  const data = await res.json()
  return data.game_id as string
}
