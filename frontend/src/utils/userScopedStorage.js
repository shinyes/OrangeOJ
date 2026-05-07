export function getUserStoragePrefix(user) {
  const id = Number(user?.id || user?.userId)
  if (Number.isInteger(id) && id > 0) {
    return `orangeoj:user:${id}`
  }

  const username = String(user?.username || '').trim()
  if (username) {
    return `orangeoj:username:${encodeURIComponent(username)}`
  }

  return 'orangeoj:user:anonymous'
}

export function selectedSpaceStorageKey(user) {
  return `${getUserStoragePrefix(user)}:selected-space-id`
}

export function codeDraftStorageKey(user, spaceId, problemId, language) {
  const scope = spaceId ? `space:${spaceId}` : 'root'
  return `${getUserStoragePrefix(user)}:code:${scope}:problem:${problemId}:language:${language}`
}

export function homeworkDraftStorageKey(user, spaceId, homeworkId) {
  return `${getUserStoragePrefix(user)}:homework:${spaceId}:${homeworkId}:draft`
}
