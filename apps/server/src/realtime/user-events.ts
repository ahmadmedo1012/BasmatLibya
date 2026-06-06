/**
 * Realtime events helper — adds session.invalidated to the v1 lookup events.
 * The lookup-room emitters live in realtime/socket.ts; this module exposes
 * user-room emitters that the auth + admin services use directly.
 */

import { Server as SocketServer } from 'socket.io'
import type { SessionInvalidatedEvent } from '@basmat/shared'

let io: SocketServer | null = null

export function setSocketServer(server: SocketServer): void {
  io = server
}

export function emitSessionInvalidated(event: SessionInvalidatedEvent): void {
  if (!io) return
  io.to(`user:${event.userId}`).emit('session.invalidated', event)
}

export function disconnectUserSockets(userId: string): void {
  if (!io) return
  void io.in(`user:${userId}`).disconnectSockets(true)
}
