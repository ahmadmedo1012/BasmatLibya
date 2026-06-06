export class AdminApiError extends Error {}

export async function listAiModels() {
  return []
}

export async function createAiModel() {
  return null
}

export async function updateAiModel() {
  return null
}

export async function activateAiModel() {
  return null
}

export async function deleteAiModel() {}

export async function listUsers() {
  return { items: [], total: 0 }
}

export async function getUser() {
  return null
}

export async function suspendUser() {
  return null
}

export async function unsuspendUser() {
  return null
}

export async function deleteUser() {}

export async function getSiteSettings() {
  return {}
}

export async function patchSiteSettings() {
  return {}
}

export async function listAudit() {
  return { items: [], total: 0 }
}
