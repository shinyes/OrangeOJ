import { api } from '../api'

function homeworkDisplayModeText(mode) {
  return mode === 'list' ? '题单模式' : '试卷模式'
}

function countHomeworkProblemIds(homework) {
  const ids = new Set()
  const items = Array.isArray(homework?.items) ? homework.items : []
  items.forEach((item) => {
    const id = Number(item?.problemId)
    if (Number.isInteger(id) && id > 0) {
      ids.add(id)
    }
  })
  return ids.size
}

export default function useHomeworkActions({
  selectedSpaceId,
  ensureCanManageSpace,
  setError,
  refreshSpaceData,
  homeworkState,
  modalState
}) {
  const openCreateHomeworkModal = () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    homeworkState.setEditingHomework(null)
    modalState.openConfigModal('create-homework')
  }

  const createHomework = async (homeworkData) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      homeworkState.setHomeworkActionMessage('')
      await api.createHomework(selectedSpaceId, homeworkData)
      await refreshSpaceData(selectedSpaceId)
      homeworkState.setHomeworkActionMessage('作业创建成功')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const openEditHomework = async (homeworkId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      const detail = await api.getHomework(selectedSpaceId, homeworkId)
      homeworkState.setEditingHomework(detail)
      modalState.openConfigModal('edit-homework')
    } catch (err) {
      setError(err.message || '加载作业详情失败')
    }
  }

  const saveEditedHomework = async (homeworkData) => {
    if (!selectedSpaceId || !homeworkState.editingHomework?.id) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      homeworkState.setHomeworkActionMessage('')
      await api.updateHomework(selectedSpaceId, homeworkState.editingHomework.id, homeworkData)
      const savedHomework = await api.getHomework(selectedSpaceId, homeworkState.editingHomework.id)
      const expectedMode = homeworkData.displayMode === 'list' ? 'list' : 'exam'
      const actualMode = savedHomework?.displayMode === 'list' ? 'list' : 'exam'
      if (actualMode !== expectedMode) {
        throw new Error(`作业基础信息已保存，但页面模式未生效。期望：${homeworkDisplayModeText(expectedMode)}，实际：${homeworkDisplayModeText(actualMode)}。请重启后端后重试。`)
      }
      await refreshSpaceData(selectedSpaceId)
      homeworkState.setEditingHomework(savedHomework)
      homeworkState.setHomeworkActionMessage('作业保存成功')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const deleteHomework = async (homeworkId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const homework = homeworkState.homeworks.find((item) => item.id === homeworkId)
    const homeworkLabel = homework?.title ? `「${homework.title}」(#${homeworkId})` : `#${homeworkId}`
    if (!window.confirm(`确认删除作业 ${homeworkLabel} 吗？`)) {
      return
    }
    try {
      setError('')
      homeworkState.setHomeworkActionMessage('')
      const detail = await api.getHomework(selectedSpaceId, homeworkId)
      const associatedProblemCount = countHomeworkProblemIds(detail)
      const deleteProblems = associatedProblemCount > 0
        ? window.confirm(`是否同时从题库删除该作业关联的 ${associatedProblemCount} 道题目？\n\n确定：删除作业并删除不再被其他作业或训练引用的关联题目。\n取消：仅删除作业，保留题目。`)
        : false
      const result = await api.deleteHomework(selectedSpaceId, homeworkId, { deleteProblems })
      if (homeworkState.editingHomework?.id === homeworkId) {
        homeworkState.setEditingHomework(null)
      }
      await refreshSpaceData(selectedSpaceId)
      if (deleteProblems) {
        const deletedProblemCount = Number(result?.deletedProblemCount || 0)
        const retainedProblemCount = Math.max(Number(result?.associatedProblemCount || associatedProblemCount) - deletedProblemCount, 0)
        if (deletedProblemCount > 0) {
          const retainedText = retainedProblemCount > 0 ? `，${retainedProblemCount} 道仍被其他作业或训练引用，已保留` : ''
          homeworkState.setHomeworkActionMessage(`作业删除成功，同时删除 ${deletedProblemCount} 道关联题目${retainedText}`)
        } else if (retainedProblemCount > 0) {
          homeworkState.setHomeworkActionMessage(`作业删除成功，${retainedProblemCount} 道关联题目仍被其他作业或训练引用，已保留`)
        } else {
          homeworkState.setHomeworkActionMessage('作业删除成功')
        }
      } else {
        homeworkState.setHomeworkActionMessage('作业删除成功')
      }
    } catch (err) {
      setError(err.message || '删除作业失败')
    }
  }

  const openAssignHomeworkTargetModal = (homeworkId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const homework = homeworkState.homeworks.find((item) => item.id === homeworkId)
    if (!homework) {
      setError('作业不存在')
      return
    }
    homeworkState.setAssigningHomework(homework)
    homeworkState.setHomeworkTargetUserId('')
    modalState.openConfigModal('assign-homework-target')
  }

  const handleAddHomeworkTarget = async (targetUsers = []) => {
    if (!selectedSpaceId || !homeworkState.assigningHomework?.id) return
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
      homeworkState.setHomeworkActionMessage('')
      homeworkState.setHomeworkTargetSubmitting(true)
      await Promise.all(uniqueUserIds.map((userId) => api.addHomeworkTarget(selectedSpaceId, homeworkState.assigningHomework.id, userId)))
      homeworkState.setHomeworkTargetUserId('')
      await refreshSpaceData(selectedSpaceId)
      homeworkState.setHomeworkActionMessage(`已将 ${uniqueUserIds.length} 名用户添加到作业 #${homeworkState.assigningHomework.id}`)
      modalState.closeConfigModal()
    } catch (err) {
      setError(err.message || '分配作业用户失败')
    } finally {
      homeworkState.setHomeworkTargetSubmitting(false)
    }
  }

  return {
    openCreateHomeworkModal,
    createHomework,
    openEditHomework,
    saveEditedHomework,
    deleteHomework,
    openAssignHomeworkTargetModal,
    handleAddHomeworkTarget
  }
}
