/** Strips active content from HTML produced from user documents before it is rendered. */
const DROP = 'script,style,iframe,object,embed,link,meta,base,form,input,button,textarea,select'

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll(DROP).forEach((el) => el.remove())
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (name.startsWith('on') || name === 'style' || name === 'srcset') el.removeAttribute(attr.name)
      else if ((name === 'href' || name === 'src') && !(value.startsWith('data:image/') || value.startsWith('#') || /^https?:/.test(value)))
        el.removeAttribute(attr.name)
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noopener noreferrer')
    }
  })
  return doc.body.innerHTML
}

export function tablesFromHtml(root: ParentNode): string[][][] {
  return [...root.querySelectorAll('table')].map((t) =>
    [...t.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('td,th')].map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())),
  )
}
