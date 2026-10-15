import { renderHook, act } from '@testing-library/react'
import { useGameSocket, backoffDelay } from './useGameSocket'

class FakeWS {
  static instances: FakeWS[] = []
  static OPEN = 1
  readyState = 0
  onopen: (() => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  constructor(public url: string) { FakeWS.instances.push(this) }
  close() {}
  send() {}
}

describe('useGameSocket', () => {
  beforeEach(() => {
    FakeWS.instances = []
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWS)
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('does not retry on 4404 and reports not found', () => {
    const { result } = renderHook(() => useGameSocket('g1', 100))
    act(() => { FakeWS.instances[0].onclose?.({ code: 4404 }) })
    act(() => { vi.advanceTimersByTime(10000) })
    expect(FakeWS.instances).toHaveLength(1)
    expect(result.current.status).toBe('closed')
    expect(result.current.closeReason).toBe('Partida no encontrada')
  })

  it('uses exponential backoff and stops after 5 retries', () => {
    const { result } = renderHook(() => useGameSocket('g1', 100))
    const delays = [100, 200, 400, 800, 1600]
    delays.forEach((d, i) => {
      act(() => { FakeWS.instances[i].onclose?.({ code: 1006 }) })
      act(() => { vi.advanceTimersByTime(d - 1) })
      expect(FakeWS.instances).toHaveLength(i + 1)
      act(() => { vi.advanceTimersByTime(1) })
      expect(FakeWS.instances).toHaveLength(i + 2)
    })
    act(() => { FakeWS.instances[5].onclose?.({ code: 1006 }) })
    expect(result.current.status).toBe('closed')
    expect(backoffDelay(3, 1500)).toBe(6000)
  })
})
