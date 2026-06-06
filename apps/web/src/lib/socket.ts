import { io, type Socket } from 'socket.io-client'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  LookupSnapshot,
} from '@basmat/shared'

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  if (socket && socket.connected) return socket
  if (!socket) {
    socket = io({
      path: '/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    // feature 002 — handle forced sign-out across tabs.
    socket.on('session.invalidated', (e) => {
      const url = new URL(window.location.href)
      const next = encodeURIComponent(url.pathname + url.search)
      switch (e.reason) {
        case 'suspended':
          window.location.assign('/suspended')
          break
        case 'removed':
        case 'manual':
        case 'expired':
        case 'rotated':
          window.location.assign(`/sign-in?next=${next}`)
          break
        case 'sign_out':
        default:
          // signed out from this tab; the route handler already navigated.
          break
      }
    })
  }
  return socket
}

export function subscribeToLookup(
  lookupId: string
): Promise<{ ok: true; replay: LookupSnapshot } | { ok: false; code: 'lookup_not_found' }> {
  const s = getSocket()
  return new Promise((resolve) => {
    s.emit('lookup.subscribe', { lookupId }, (ack) => resolve(ack))
  })
}

export function unsubscribeFromLookup(lookupId: string) {
  const s = getSocket()
  s.emit('lookup.unsubscribe', { lookupId })
}
