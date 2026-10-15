import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from './App'
import { demoState } from './demo/fixtures'

describe('App menu', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true, status: 201, json: () => Promise.resolve({ list_id: 'd1', state: demoState([]) }),
    } as Response)))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('starts on the menu and opens the setup screen', () => {
    render(<App />)
    expect(screen.getByTestId('menu-screen')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('menu-play'))
    expect(screen.getByText('Jugar')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('setup-back'))
    expect(screen.getByTestId('menu-screen')).toBeInTheDocument()
  })

  it('opens the circular list demo and returns to the menu', async () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('menu-demo'))
    expect(screen.getByTestId('demo-screen')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('demo-empty')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('demo-back'))
    expect(screen.getByTestId('menu-screen')).toBeInTheDocument()
  })
})
