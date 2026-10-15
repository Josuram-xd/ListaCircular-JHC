import type { DemoState } from './types'

interface Props {
  state: DemoState | null
  onNodeClick?: (name: string) => void
}

const W = 640
const H = 560
const CX = W / 2
const CY = H / 2
const NODE_R = 30

type P = { x: number; y: number }

function positions(n: number): P[] {
  if (n === 1) return [{ x: CX, y: CY }]
  const R = n <= 2 ? 150 : Math.min(200, 110 + n * 12)
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) }
  })
}

function toward(p: P, q: P, d: number): P {
  const l = Math.hypot(q.x - p.x, q.y - p.y) || 1
  return { x: p.x + ((q.x - p.x) / l) * d, y: p.y + ((q.y - p.y) / l) * d }
}

/** Flecha curva de a hacia b; el desvío cae siempre al mismo lado del sentido de la flecha. */
function arrowPath(a: P, b: P, bend: number): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const c = { x: (a.x + b.x) / 2 - (dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend }
  const s = toward(a, c, NODE_R)
  const e = toward(b, c, NODE_R + 6)
  return `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}`
}

export default function CircularListView({ state, onNodeClick }: Props) {
  const nodes = state?.nodes ?? []
  const n = nodes.length
  const pos = positions(n)
  const hl = new Set(state?.highlight ?? [])
  const bend = n === 2 ? 40 : 26

  return (
    <svg
      className="clist"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Lista circular con ${n} nodos`}
      data-testid="demo-graph"
    >
      <defs>
        <marker id="arrow-next" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
        <marker id="arrow-prev" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--prev)" />
        </marker>
      </defs>

      {n === 0 && (
        <text x={CX} y={CY} textAnchor="middle" className="clist__empty" data-testid="demo-empty">
          Lista vacía: inserta un nodo
        </text>
      )}

      {n === 1 && (
        <g data-testid="demo-self-loop">
          <path
            className="clist__edge clist__edge--next"
            d={`M ${CX - 12} ${CY - NODE_R} C ${CX - 60} ${CY - NODE_R - 80} ${CX + 60} ${CY - NODE_R - 80} ${CX + 12} ${CY - NODE_R - 6}`}
            markerEnd="url(#arrow-next)"
          />
          <path
            className="clist__edge clist__edge--prev"
            d={`M ${CX + 12} ${CY + NODE_R} C ${CX + 60} ${CY + NODE_R + 80} ${CX - 60} ${CY + NODE_R + 80} ${CX - 12} ${CY + NODE_R + 6}`}
            markerEnd="url(#arrow-prev)"
          />
          <text x={CX + 70} y={CY - NODE_R - 40} className="clist__edge-label clist__edge-label--next">siguiente</text>
          <text x={CX + 70} y={CY + NODE_R + 50} className="clist__edge-label clist__edge-label--prev">anterior</text>
        </g>
      )}

      {n >= 2 &&
        nodes.map((node, i) => {
          const nextIdx = nodes.findIndex((x) => x.name === node.next)
          const prevIdx = nodes.findIndex((x) => x.name === node.prev)
          return (
            <g key={`edges-${node.name}`}>
              {nextIdx >= 0 && (
                <path
                  className="clist__edge clist__edge--next"
                  d={arrowPath(pos[i], pos[nextIdx], bend)}
                  markerEnd="url(#arrow-next)"
                  data-testid={`demo-next-${node.name}`}
                />
              )}
              {prevIdx >= 0 && (
                <path
                  className="clist__edge clist__edge--prev"
                  d={arrowPath(pos[i], pos[prevIdx], bend)}
                  markerEnd="url(#arrow-prev)"
                  data-testid={`demo-prev-${node.name}`}
                />
              )}
            </g>
          )
        })}

      {nodes.map((node, i) => {
        const { x, y } = pos[i]
        const cls = [
          'clist__node',
          node.is_pointer ? 'clist__node--pointer' : '',
          node.is_head ? 'clist__node--head' : '',
          hl.has(node.name) ? 'clist__node--hl' : '',
        ].filter(Boolean).join(' ')
        return (
          <g
            key={node.name}
            className={cls}
            transform={`translate(${x} ${y})`}
            data-testid={`demo-node-${node.name}`}
            data-pointer={node.is_pointer ? 'true' : 'false'}
            data-head={node.is_head ? 'true' : 'false'}
            data-highlight={hl.has(node.name) ? 'true' : 'false'}
            role="button"
            tabIndex={0}
            aria-label={`Nodo ${node.name}${node.is_head ? ', cabeza' : ''}${node.is_pointer ? ', puntero' : ''}`}
            onClick={() => onNodeClick?.(node.name)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNodeClick?.(node.name) }
            }}
          >
            {node.is_pointer && <circle r={NODE_R + 8} className="clist__ring" />}
            <circle r={NODE_R} className="clist__disc" />
            <text textAnchor="middle" dy="0.35em" className="clist__name">
              {node.name.length > 7 ? node.name.slice(0, 6) + '…' : node.name}
            </text>
            {node.is_head && (
              <g transform={`translate(0 ${-NODE_R - 14})`}>
                <rect x={-22} y={-10} width={44} height={18} rx={9} className="clist__badge clist__badge--head" />
                <text textAnchor="middle" dy="0.3em" className="clist__badge-text">HEAD</text>
              </g>
            )}
            {node.is_pointer && (
              <g transform={`translate(0 ${NODE_R + 20})`}>
                <rect x={-30} y={-10} width={60} height={18} rx={9} className="clist__badge clist__badge--ptr" />
                <text textAnchor="middle" dy="0.3em" className="clist__badge-text">puntero</text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
