export interface DemoNode {
  name: string
  next: string
  prev: string
  is_head: boolean
  is_pointer: boolean
}

export interface DemoOp {
  op: 'insert' | 'remove' | 'advance' | 'retreat' | 'lap' | 'reset'
  name?: string
  where?: 'start' | 'end' | 'after_pointer'
}

export interface DemoState {
  list_id: string
  size: number
  pointer: string | null
  nodes: DemoNode[]
  last_op: DemoOp | null
  steps: string[]
  highlight: string[]
}
