import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

// Node 25 ships its own global `localStorage`, which is an unusable stub unless started with
// --localstorage-file, and it shadows jsdom's. Swap in a small in-memory Storage for component tests.
if (typeof window !== 'undefined' && typeof globalThis.localStorage?.clear !== 'function') {
  const store = new Map<string, string>()
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
  for (const target of [window, globalThis]) {
    Object.defineProperty(target, 'localStorage', { value: storage, configurable: true, writable: true })
  }
}
