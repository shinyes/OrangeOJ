import { api } from '../api'

function normalizeProblemTags(tags) {
  if (!Array.isArray(tags)) return []
  const seen = new Set()
  return tags
    .map((item) => String(item || '').trim())
    .filter((item) => {
      if (!item) return false
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function problemTagsMismatch(expectedTags, actualTags) {
  const expected = normalizeProblemTags(expectedTags)
  const actual = normalizeProblemTags(actualTags)
  if (expected.length !== actual.length) return true
  return expected.some((tag, index) => tag !== actual[index])
}

export default function useProblemActions({
  selectedSpaceId,
  ensureCanManageSpace,
  setError,
  refreshSpaceData,
  problemState,
  modalState
}) {
  const createSpaceProblem = async (problemData) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      const created = await api.createSpaceProblem(selectedSpaceId, problemData)
      const createdProblem = await api.getProblem(selectedSpaceId, created?.id)
      if (problemTagsMismatch(problemData.tags, createdProblem?.tags)) {
        throw new Error('题目标签未生效，请重启后端后重试')
      }
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const removeSpaceProblem = async (problemId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      await api.deleteSpaceProblem(selectedSpaceId, problemId)
      await refreshSpaceData(selectedSpaceId)
      if (problemState.editingProblemId === problemId) {
        problemState.setEditingProblemId(null)
        problemState.setEditingSpaceProblem(null)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const openEditProblem = (problemId) => {
    const problem = problemState.spaceProblems.find((item) => item.id === problemId)
    if (!problem) {
      setError('题目详情尚未加载完成，请稍后重试')
      return
    }
    problemState.setEditingProblemId(problemId)
    problemState.setEditingSpaceProblem(problem)
    modalState.openConfigModal('edit-space-problem')
  }

  const saveEditedSpaceProblem = async (problemData) => {
    if (!selectedSpaceId || !problemState.editingSpaceProblem?.id) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      await api.updateSpaceProblem(selectedSpaceId, problemState.editingSpaceProblem.id, problemData)
      const updatedProblem = await api.getProblem(selectedSpaceId, problemState.editingSpaceProblem.id)
      if (problemTagsMismatch(problemData.tags, updatedProblem?.tags)) {
        throw new Error('题目标签未生效，请重启后端后重试')
      }
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  return {
    createSpaceProblem,
    removeSpaceProblem,
    openEditProblem,
    saveEditedSpaceProblem
  }
}
