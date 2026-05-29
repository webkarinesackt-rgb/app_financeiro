'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

const KEY = 'fysi:hideValues'
const EVENT = 'fysi:hideValues:change'

function read(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(KEY) === '1'
}

function subscribe(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onChange = () => cb()
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb() }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function write(v: boolean): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, v ? '1' : '0')
  document.documentElement.dataset.hideValues = v ? 'true' : 'false'
  window.dispatchEvent(new CustomEvent(EVENT, { detail: v }))
}

// Sincroniza o atributo `data-hide-values` no <html> com localStorage.
// CSS global em globals.css faz o blur dos elementos `.private`.
export function usePrivacy(): { hidden: boolean; toggle: () => void } {
  const hidden = useSyncExternalStore(subscribe, read, () => false)

  useEffect(() => {
    document.documentElement.dataset.hideValues = hidden ? 'true' : 'false'
  }, [hidden])

  const toggle = useCallback(() => { write(!read()) }, [])

  return { hidden, toggle }
}
