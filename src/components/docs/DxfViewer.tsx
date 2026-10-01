import { useEffect, useState } from 'react'
import { decodeText } from '@/docs/encoding'
import { cleanMtext } from '@/docs/dxfText'

interface Shape {
  d?: string
  circle?: [number, number, number]
  text?: { x: number; y: number; h: number; s: string; rot: number }
}

type Pt = { x: number; y: number }
type Ent = Record<string, unknown> & { type: string }
type Tf = (p: Pt) => Pt

const identity: Tf = (p) => p

function arcPath(c: Pt, r: number, a0: number, a1: number, tf: Tf): string {
  let end = a1
  while (end <= a0) end += Math.PI * 2
  const steps = Math.max(8, Math.ceil(((end - a0) / (Math.PI * 2)) * 48))
  const pts: Pt[] = []
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((end - a0) * i) / steps
    pts.push(tf({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }))
  }
  return 'M' + pts.map((p) => `${p.x},${p.y}`).join('L')
}

/** Converts parsed DXF entities (with INSERT blocks expanded) into simple SVG shapes. */
function toShapes(entities: Ent[], blocks: Record<string, { entities?: Ent[] }>, tf: Tf, depth: number, out: Shape[]) {
  for (const e of entities) {
    if (out.length > 60000) return
    const v = e.vertices as Pt[] | undefined
    switch (e.type) {
      case 'LINE':
      case 'LWPOLYLINE':
      case 'POLYLINE': {
        if (!v?.length) break
        const pts = v.map(tf)
        out.push({ d: 'M' + pts.map((p) => `${p.x},${p.y}`).join('L') + (e.shape ? 'Z' : '') })
        break
      }
      case 'CIRCLE': {
        const c = tf(e.center as Pt)
        const edge = tf({ x: (e.center as Pt).x + (e.radius as number), y: (e.center as Pt).y })
        out.push({ circle: [c.x, c.y, Math.hypot(edge.x - c.x, edge.y - c.y)] })
        break
      }
      case 'ARC':
        out.push({ d: arcPath(e.center as Pt, e.radius as number, e.startAngle as number, e.endAngle as number, tf) })
        break
      case 'TEXT':
      case 'MTEXT': {
        const p = (e.startPoint ?? e.position) as Pt | undefined
        const s = typeof e.text === 'string' ? cleanMtext(e.text) : ''
        if (!p || !s) break
        const q = tf(p)
        const h = Math.abs(tf({ x: p.x, y: p.y + ((e.textHeight ?? e.height ?? 2.5) as number) }).y - q.y)
        out.push({ text: { x: q.x, y: q.y, h: h || 2.5, s, rot: (e.rotation as number) || 0 } })
        break
      }
      case 'INSERT': {
        const b = blocks[e.name as string]
        if (!b?.entities || depth > 6) break
        const pos = (e.position as Pt) ?? { x: 0, y: 0 }
        const sx = (e.xScale as number) ?? 1
        const sy = (e.yScale as number) ?? 1
        const rot = (((e.rotation as number) ?? 0) * Math.PI) / 180
        const cos = Math.cos(rot), sin = Math.sin(rot)
        const local: Tf = (p) => tf({ x: pos.x + (p.x * sx) * cos - (p.y * sy) * sin, y: pos.y + (p.x * sx) * sin + (p.y * sy) * cos })
        toShapes(b.entities, blocks, local, depth + 1, out)
        break
      }
    }
  }
}

export function DxfViewer({ data }: { data: Uint8Array }) {
  const [state, setState] = useState<{ shapes: Shape[]; box: [number, number, number, number] } | { error: string } | null>(null)
  useEffect(() => {
    let alive = true
    import('dxf-parser').then(({ default: DxfParser }) => {
      try {
        const dxf = new DxfParser().parseSync(decodeText(data))
        const shapes: Shape[] = []
        toShapes((dxf?.entities ?? []) as unknown as Ent[], (dxf?.blocks ?? {}) as unknown as Record<string, { entities?: Ent[] }>, identity, 0, shapes)
        let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
        const grow = (x: number, y: number) => {
          if (!Number.isFinite(x) || !Number.isFinite(y)) return
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
        }
        for (const s of shapes) {
          if (s.d) for (const m of s.d.matchAll(/(-?[\d.e+-]+),(-?[\d.e+-]+)/g)) grow(Number(m[1]), Number(m[2]))
          if (s.circle) { grow(s.circle[0] - s.circle[2], s.circle[1] - s.circle[2]); grow(s.circle[0] + s.circle[2], s.circle[1] + s.circle[2]) }
          if (s.text) grow(s.text.x, s.text.y)
        }
        if (alive) setState(Number.isFinite(x0) ? { shapes, box: [x0, y0, x1 - x0 || 1, y1 - y0 || 1] } : { error: 'На чертеже нет поддерживаемых объектов' })
      } catch (err) {
        if (alive) setState({ error: err instanceof Error ? err.message : 'Ошибка чтения DXF' })
      }
    })
    return () => {
      alive = false
    }
  }, [data])

  if (!state) return <p className="p-6 text-sm text-zinc-500">Чтение чертежа…</p>
  if ('error' in state) return <p className="p-6 text-sm text-red-600">{state.error}</p>
  const [x, y, w, h] = state.box
  const pad = Math.max(w, h) * 0.02
  const stroke = Math.max(w, h) / 1500
  return (
    <div className="overflow-auto bg-white p-2 dark:bg-zinc-950">
      <svg viewBox={`${x - pad} ${-(y + h) - pad} ${w + 2 * pad} ${h + 2 * pad}`} className="h-[70vh] w-full text-zinc-800 dark:text-zinc-200">
        <g transform="scale(1,-1)" fill="none" stroke="currentColor" strokeWidth={stroke}>
          {state.shapes.map((s, i) =>
            s.d ? <path key={i} d={s.d} /> : s.circle ? <circle key={i} cx={s.circle[0]} cy={s.circle[1]} r={s.circle[2]} /> : null,
          )}
        </g>
        <g fill="currentColor" stroke="none">
          {state.shapes.map((s, i) =>
            s.text ? (
              <text key={i} x={s.text.x} y={-s.text.y} fontSize={s.text.h} transform={s.text.rot ? `rotate(${-s.text.rot} ${s.text.x} ${-s.text.y})` : undefined}>
                {s.text.s.split('\n')[0]}
              </text>
            ) : null,
          )}
        </g>
      </svg>
    </div>
  )
}
