import { create } from 'zustand'
import { uid } from '@/lib/id'

export interface Toast {
  id: string
  text: string
  tone: 'info' | 'success' | 'error'
  action?: { label: string; to: string }
}

interface ToastState {
  toasts: Toast[]
  push(t: Omit<Toast, 'id'>): void
  dismiss(id: string): void
}

export const useToasts = create<ToastState>()((set) => ({
  toasts: [],
  push(t) {
    const id = uid()
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 5000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = (text: string, opts: Partial<Omit<Toast, 'id' | 'text'>> = {}) =>
  useToasts.getState().push({ text, tone: 'success', ...opts })
