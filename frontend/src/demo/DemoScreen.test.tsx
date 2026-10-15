import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DemoScreen from './DemoScreen'
import { demoState } from './fixtures'

function jsonRes(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)
}

describe('DemoScreen', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  const lastBody = () => JSON.parse(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][1].body)

  it('creates an empty list on mount and sends an insert op', async () => {
    fetchMock.mockReturnValueOnce(jsonRes(201, { list_id: 'd1', state: demoState([]) }))
    render(<DemoScreen onBack={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('demo-empty')).toBeInTheDocument())

    fetchMock.mockReturnValueOnce(jsonRes(200, demoState(['Marta'], { steps: ['Se crea Marta.'] })))
    fireEvent.change(screen.getByTestId('demo-name-input'), { target: { value: ' Marta ' } })
    fireEvent.click(screen.getByTestId('demo-insert-after'))
    await waitFor(() => expect(screen.getByTestId('demo-node-Marta')).toBeInTheDocument())
    expect(fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0]).toMatch(/\/demo\/lists\/d1\/ops$/)
    expect(lastBody()).toEqual({ op: 'insert', name: 'Marta', where: 'after_pointer' })
    expect(screen.getByTestId('demo-steps')).toHaveTextContent('Se crea Marta.')
    expect(screen.getByTestId('demo-row-Marta')).toBeInTheDocument()
  })

  it('shows the detail of a 422 error', async () => {
    fetchMock.mockReturnValueOnce(jsonRes(201, { list_id: 'd1', state: demoState(['Ana']) }))
    render(<DemoScreen onBack={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('demo-node-Ana')).toBeInTheDocument())

    fetchMock.mockReturnValueOnce(jsonRes(422, { detail: 'Ya existe un nodo llamado Ana' }))
    fireEvent.change(screen.getByTestId('demo-name-input'), { target: { value: 'Ana' } })
    fireEvent.click(screen.getByTestId('demo-insert-end'))
    expect(await screen.findByTestId('demo-error')).toHaveTextContent('Ya existe un nodo llamado Ana')
    expect(screen.getByTestId('demo-node-Ana')).toBeInTheDocument()
  })

  it('shows a 404 detail', async () => {
    fetchMock.mockReturnValueOnce(jsonRes(201, { list_id: 'd1', state: demoState(['Ana', 'Luis']) }))
    render(<DemoScreen onBack={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('demo-node-Ana')).toBeInTheDocument())
    fetchMock.mockReturnValueOnce(jsonRes(404, { detail: 'Lista no encontrada' }))
    fireEvent.click(screen.getByTestId('demo-advance'))
    expect(await screen.findByTestId('demo-error')).toHaveTextContent('Lista no encontrada')
  })

  it('advance, retreat, lap and reset send their ops', async () => {
    fetchMock.mockReturnValueOnce(jsonRes(201, { list_id: 'd1', state: demoState(['Ana', 'Luis']) }))
    render(<DemoScreen onBack={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('demo-node-Ana')).toBeInTheDocument())
    for (const [id, op] of [['demo-advance', 'advance'], ['demo-retreat', 'retreat'], ['demo-lap', 'lap'], ['demo-reset', 'reset']]) {
      fetchMock.mockReturnValueOnce(jsonRes(200, demoState(['Ana', 'Luis'])))
      const count = fetchMock.mock.calls.length
      fireEvent.click(screen.getByTestId(id))
      await waitFor(() => expect(fetchMock.mock.calls.length).toBe(count + 1))
      expect(lastBody()).toEqual({ op })
      await waitFor(() => expect(screen.getByTestId(id)).not.toBeDisabled())
    }
  })

  it('removes a node by clicking it', async () => {
    fetchMock.mockReturnValueOnce(jsonRes(201, { list_id: 'd1', state: demoState(['Ana', 'Luis']) }))
    render(<DemoScreen onBack={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('demo-node-Luis')).toBeInTheDocument())
    fetchMock.mockReturnValueOnce(jsonRes(200, demoState(['Ana'])))
    fireEvent.click(screen.getByTestId('demo-node-Luis'))
    await waitFor(() => expect(screen.queryByTestId('demo-node-Luis')).not.toBeInTheDocument())
    expect(lastBody()).toEqual({ op: 'remove', name: 'Luis' })
  })

  it('example button creates a list with 4 preloaded names', async () => {
    fetchMock.mockReturnValueOnce(jsonRes(201, { list_id: 'd1', state: demoState([]) }))
    render(<DemoScreen onBack={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('demo-empty')).toBeInTheDocument())
    fetchMock.mockReturnValueOnce(jsonRes(201, { list_id: 'd2', state: demoState(['Ana', 'Luis', 'Eva', 'Marta']) }))
    fireEvent.click(screen.getByTestId('demo-example'))
    await waitFor(() => expect(screen.getByTestId('demo-node-Marta')).toBeInTheDocument())
    expect(lastBody()).toEqual({ names: ['Ana', 'Luis', 'Eva', 'Marta'] })
  })

  it('back button calls onBack', async () => {
    fetchMock.mockReturnValue(jsonRes(201, { list_id: 'd1', state: demoState([]) }))
    const onBack = vi.fn()
    render(<DemoScreen onBack={onBack} />)
    fireEvent.click(screen.getByTestId('demo-back'))
    expect(onBack).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByTestId('demo-empty')).toBeInTheDocument())
  })
})
