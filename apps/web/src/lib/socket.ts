export function getSocket() {
  return {
    on() {},
    off() {},
    emit() {},
    connected: false,
  }
}

export function subscribeToLookup(
  _lookupId: string
): Promise<{ ok: false; code: 'lookup_not_found' }> {
  return Promise.resolve({ ok: false, code: 'lookup_not_found' })
}

export function unsubscribeFromLookup(_lookupId: string) {}
