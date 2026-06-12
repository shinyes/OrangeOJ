import { api } from '../api'

function practiceDisplayModeText(mode) {
  return mode === 'list' ? '题单模式' : '试卷模式'
}

function countPracticeProblemIds(practice) {
  const ids = new Set()
  const items = Array.isArray(practice?.items) ? practice.items : []
  items.forEach((item) => {
    const id = Number(item?.problemId)
    if (Number.isInteger(id) && id > 0) {
      ids.add(id)
    }
  })
  return ids.size
}

export default function usePracticeActions({
  selectedSpaceId,
  ensureCanManageSpace,
  setError,
  refreshSpaceData,
  practiceState,
  modalState,
  confirmAction
}) {
  const openCreatePracticeModal = () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    practiceState.setEditingPractice(null)
    modalState.openConfigModal('create-practice')
  }

  const createPractice = async (practiceData) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      practiceState.setPracticeActionMessage('')
      await api.createPractice(selectedSpaceId, practiceData)
      await refreshSpaceData(selectedSpaceId)
      practiceState.setPracticeActionMessage('练习创建成功')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const openEditPractice = async (practiceId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      const detail = await api.getPractice(selectedSpaceId, practiceId)
      practiceState.setEditingPractice(detail)
      modalState.openConfigModal('edit-practice')
    } catch (err) {
      setError(err.message || '加载练习详情失败')
    }
  }

  const saveEditedPractice = async (practiceData) => {
    if (!selectedSpaceId || !practiceState.editingPractice?.id) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      practiceState.setPracticeActionMessage('')
      await api.updatePractice(selectedSpaceId, practiceState.editingPractice.id, practiceData)
      const savedPractice = await api.getPractice(selectedSpaceId, practiceState.editingPractice.id)
      const expectedMode = practiceData.displayMode === 'list' ? 'list' : 'exam'
      const actualMode = savedPractice?.displayMode === 'list' ? 'list' : 'exam'
      if (actualMode !== expectedMode) {
        throw new Error(`练习基础信息已保存，但页面模式未生效。期望：${practiceDisplayModeText(expectedMode)}，实际：${practiceDisplayModeText(actualMode)}。请重启后端后重试。`)
      }
      await refreshSpaceData(selectedSpaceId)
      practiceState.setEditingPractice(savedPractice)
      practiceState.setPracticeActionMessage('练习保存成功')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const deletePractice = async (practiceId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const practice = practiceState.practices.find((item) => item.id === practiceId)
    const practiceLabel = practice?.title ? `「${practice.title}」(#${practiceId})` : `#${practiceId}`
    const confirmed = await confirmAction({
      title: '删除练习',
      message: `确认删除练习 ${practiceLabel} 吗？`,
      confirmText: '删除练习',
      cancelText: '取消',
      confirmColor: 'error'
    })
    if (!confirmed) {
      return
    }
    try {
      setError('')
      practiceState.setPracticeActionMessage('')
      const detail = await api.getPractice(selectedSpaceId, practiceId)
      const associatedProblemCount = countPracticeProblemIds(detail)
      const deleteProblems = associatedProblemCount > 0
        ? await confirmAction({
            title: '删除关联题目',
            message: `是否同时从题库删除该练习关联的 ${associatedProblemCount} 道题目？\n\n会删除不再被其他练习或训练引用的关联题目，并连带清理提交记录。\n选择“仅删除练习”会保留题目。`,
            confirmText: '同时删除题目',
            cancelText: '仅删除练习',
            confirmColor: 'error'
          })
        : false
      const result = await api.deletePractice(selectedSpaceId, practiceId, { deleteProblems })
      if (practiceState.editingPractice?.id === practiceId) {
        practiceState.setEditingPractice(null)
      }
      await refreshSpaceData(selectedSpaceId)
      if (deleteProblems) {
        const deletedProblemCount = Number(result?.deletedProblemCount || 0)
        const retainedProblemCount = Math.max(Number(result?.associatedProblemCount || associatedProblemCount) - deletedProblemCount, 0)
        if (deletedProblemCount > 0) {
          const retainedText = retainedProblemCount > 0 ? `，${retainedProblemCount} 道仍被其他练习或训练引用，已保留` : ''
          practiceState.setPracticeActionMessage(`练习删除成功，同时删除 ${deletedProblemCount} 道关联题目${retainedText}`)
        } else if (retainedProblemCount > 0) {
          practiceState.setPracticeActionMessage(`练习删除成功，${retainedProblemCount} 道关联题目仍被其他练习或训练引用，已保留`)
        } else {
          practiceState.setPracticeActionMessage('练习删除成功')
        }
      } else {
        practiceState.setPracticeActionMessage('练习删除成功')
      }
    } catch (err) {
      setError(err.message || '删除练习失败')
    }
  }

  const openAssignPracticeTargetModal = (practiceId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const practice = practiceState.practices.find((item) => item.id === practiceId)
    if (!practice) {
      setError('练习不存在')
      return
    }
    practiceState.setAssigningPractice(practice)
    practiceState.setPracticeTargetUserId('')
    modalState.openConfigModal('assign-practice-target')
  }

  const handleAddPracticeTarget = async (targetUsers = []) => {
    if (!selectedSpaceId || !practiceState.assigningPractice?.id) return
    if (!ensureCanManageSpace()) return
    const userIds = Array.isArray(targetUsers)
      ? targetUsers.map((user) => Number(user?.id || user?.userId)).filter((userId) => Number.isInteger(userId) && userId > 0)
      : []
    const uniqueUserIds = Array.from(new Set(userIds))

    if (uniqueUserIds.length === 0) {
      setError('请先选择要分配的用户')
      return
    }

    try {
      setError('')
      practiceState.setPracticeActionMessage('')
      practiceState.setPracticeTargetSubmitting(true)
      await Promise.all(uniqueUserIds.map((userId) => api.addPracticeTarget(selectedSpaceId, practiceState.assigningPractice.id, userId)))
      practiceState.setPracticeTargetUserId('')
      await refreshSpaceData(selectedSpaceId)
      practiceState.setPracticeActionMessage(`已将 ${uniqueUserIds.length} 名用户添加到练习 #${practiceState.assigningPractice.id}`)
      modalState.closeConfigModal()
    } catch (err) {
      setError(err.message || '分配练习用户失败')
    } finally {
      practiceState.setPracticeTargetSubmitting(false)
    }
  }

  return {
    openCreatePracticeModal,
    createPractice,
    openEditPractice,
    saveEditedPractice,
    deletePractice,
    openAssignPracticeTargetModal,
    handleAddPracticeTarget
  }
}
