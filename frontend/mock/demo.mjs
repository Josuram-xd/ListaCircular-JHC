// Mock simple de /demo (el backend real manda las explicaciones).
const lists = new Map()
let counter = 0
const MAX = 12

function build(l, lastOp, steps, highlight) {
  const n = l.names.length
  return {
    list_id: l.id,
    size: n,
    pointer: l.pointer,
    nodes: l.names.map((name, i) => ({
      name,
      next: l.names[(i + 1) % n],
      prev: l.names[(i - 1 + n) % n],
      is_head: i === 0,
      is_pointer: name === l.pointer,
    })),
    last_op: lastOp,
    steps,
    highlight,
  }
}

class HttpErr extends Error { constructor(code, detail) { super(detail); this.code = code } }

function validName(l, name) {
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 12) throw new HttpErr(422, 'El nombre debe tener entre 1 y 12 caracteres')
  const t = name.trim()
  if (l.names.includes(t)) throw new HttpErr(422, `Ya existe un nodo llamado ${t}`)
  if (l.names.length >= MAX) throw new HttpErr(422, `La lista admite como máximo ${MAX} nodos`)
  return t
}

function apply(l, d) {
  const n = l.names.length
  const idx = l.names.indexOf(l.pointer)
  switch (d.op) {
    case 'insert': {
      const name = validName(l, d.name)
      const where = d.where
      if (!['start', 'end', 'after_pointer'].includes(where)) throw new HttpErr(422, 'where debe ser start, end o after_pointer')
      if (n === 0) {
        l.names.push(name); l.pointer = name
        return build(l, { op: 'insert', name, where }, [`Se crea ${name}.`, `${name}.siguiente = ${name} y ${name}.anterior = ${name} (un solo nodo se apunta a sí mismo).`], [name])
      }
      const at = where === 'start' ? 0 : where === 'end' ? n : idx + 1
      const prev = l.names[(at - 1 + n) % n]
      const next = l.names[at % n]
      l.names.splice(at, 0, name)
      return build(l, { op: 'insert', name, where }, [
        `Se crea el nodo ${name}.`,
        `${name}.anterior = ${prev} y ${name}.siguiente = ${next}.`,
        `${prev}.siguiente = ${name} y ${next}.anterior = ${name}.`,
      ], [name, prev, next])
    }
    case 'remove': {
      const i = l.names.indexOf(d.name)
      if (i < 0) throw new HttpErr(422, `No existe el nodo ${d.name}`)
      const prev = l.names[(i - 1 + n) % n]
      const next = l.names[(i + 1) % n]
      l.names.splice(i, 1)
      const steps = []
      if (n === 1) {
        l.pointer = null
        steps.push(`${d.name} era el único nodo: la lista queda vacía.`)
      } else {
        steps.push(`${prev}.siguiente = ${next} y ${next}.anterior = ${prev}.`)
        if (l.pointer === d.name) { l.pointer = next; steps.push(`El puntero pasaba por ${d.name}; ahora apunta a ${next}.`) }
        steps.push(`${d.name} queda desconectado.`)
      }
      return build(l, { op: 'remove', name: d.name }, steps, n === 1 ? [] : [prev, next])
    }
    case 'advance':
    case 'retreat': {
      if (n === 0) throw new HttpErr(422, 'La lista está vacía')
      const to = l.names[(idx + (d.op === 'advance' ? 1 : -1) + n) % n]
      const from = l.pointer
      l.pointer = to
      return build(l, { op: d.op }, [d.op === 'advance' ? `El puntero sigue ${from}.siguiente = ${to}.` : `El puntero sigue ${from}.anterior = ${to}.`], [from, to])
    }
    case 'lap': {
      if (n === 0) throw new HttpErr(422, 'La lista está vacía')
      const order = Array.from({ length: n }, (_, k) => l.names[(idx + k) % n])
      return build(l, { op: 'lap' }, [`Recorrido: ${[...order, order[0]].join(' → ')}.`, 'Tras n pasos se vuelve al punto de partida.'], order)
    }
    case 'reset': {
      l.names = []; l.pointer = null
      return build(l, { op: 'reset' }, ['La lista se vacía.'], [])
    }
    default:
      throw new HttpErr(422, 'Operación inválida')
  }
}

export function handleDemo(req, url, json) {
  if (!url.pathname.startsWith('/demo/lists')) return false
  const readBody = (cb) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let d = {}
      if (body.trim()) { try { d = JSON.parse(body) } catch { return json(422, { detail: 'JSON inválido' }) } }
      try { cb(d) } catch (e) { if (e instanceof HttpErr) json(e.code, { detail: e.message }); else throw e }
    })
  }
  if (req.method === 'POST' && url.pathname === '/demo/lists') {
    readBody((d) => {
      const names = d.names ?? []
      if (!Array.isArray(names) || names.length > MAX || new Set(names).size !== names.length || names.some((x) => typeof x !== 'string' || x.length < 1 || x.length > 12)) {
        throw new HttpErr(422, 'names debe tener 0 a 12 nombres únicos de 1 a 12 caracteres')
      }
      const l = { id: `d${++counter}`, names: [...names], pointer: names[0] ?? null }
      lists.set(l.id, l)
      json(201, { list_id: l.id, state: build(l, null, names.length ? [`Se crea la lista con ${names.join(', ')}.`] : ['Lista vacía.'], names) })
    })
    return true
  }
  let m = url.pathname.match(/^\/demo\/lists\/([^/]+)\/ops$/)
  if (req.method === 'POST' && m) {
    readBody((d) => {
      const l = lists.get(m[1])
      if (!l) throw new HttpErr(404, 'Lista no encontrada')
      json(200, apply(l, d))
    })
    return true
  }
  m = url.pathname.match(/^\/demo\/lists\/([^/]+)$/)
  if (req.method === 'GET' && m) {
    const l = lists.get(m[1])
    if (!l) json(404, { detail: 'Lista no encontrada' })
    else json(200, build(l, null, [], []))
    return true
  }
  json(404, { detail: 'No encontrado' })
  return true
}
