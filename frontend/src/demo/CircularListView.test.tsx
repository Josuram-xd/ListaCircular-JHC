import { render, screen, fireEvent } from '@testing-library/react'
import CircularListView from './CircularListView'
import { demoState } from './fixtures'

describe('CircularListView', () => {
  it('shows an empty message with no nodes', () => {
    render(<CircularListView state={demoState([])} />)
    expect(screen.getByTestId('demo-empty')).toBeInTheDocument()
  })

  it('draws a single node pointing to itself', () => {
    render(<CircularListView state={demoState(['Ana'])} />)
    expect(screen.getByTestId('demo-node-Ana')).toBeInTheDocument()
    expect(screen.getByTestId('demo-self-loop')).toBeInTheDocument()
  })

  it('draws nodes, next/prev arrows, head, pointer and highlight', () => {
    const state = demoState(['Ana', 'Luis', 'Eva'], { highlight: ['Eva'] })
    render(<CircularListView state={state} />)
    for (const n of ['Ana', 'Luis', 'Eva']) {
      expect(screen.getByTestId(`demo-node-${n}`)).toBeInTheDocument()
      expect(screen.getByTestId(`demo-next-${n}`)).toBeInTheDocument()
      expect(screen.getByTestId(`demo-prev-${n}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('demo-node-Ana')).toHaveAttribute('data-head', 'true')
    expect(screen.getByTestId('demo-node-Ana')).toHaveAttribute('data-pointer', 'true')
    expect(screen.getByTestId('demo-node-Luis')).toHaveAttribute('data-pointer', 'false')
    expect(screen.getByTestId('demo-node-Eva')).toHaveAttribute('data-highlight', 'true')
    expect(screen.getByText('HEAD')).toBeInTheDocument()
  })

  it('calls onNodeClick with the node name', () => {
    const onNodeClick = vi.fn()
    render(<CircularListView state={demoState(['Ana', 'Luis'])} onNodeClick={onNodeClick} />)
    fireEvent.click(screen.getByTestId('demo-node-Luis'))
    expect(onNodeClick).toHaveBeenCalledWith('Luis')
  })
})
