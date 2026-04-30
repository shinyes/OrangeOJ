import { api } from '../api'

function homeworkDisplayModeText(mode) {
  return mode === 'list' ? '题单模式' : '试卷模式'
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
    if (!window.confirm(`确认删除作业 #${homeworkId} 吗？`)) {
      return
    }
    try {
      setError('')
      homeworkState.setHomeworkActionMessage('')
      await api.deleteHomework(selectedSpaceId, homeworkId)
      if (homeworkState.editingHomework?.id === homeworkId) {
        homeworkState.setEditingHomework(null)
      }
      await refreshSpaceData(selectedSpaceId)
      homeworkState.setHomeworkActionMessage('作业删除成功')
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

  const handleAddHomeworkTarget = async () => {
    if (!selectedSpaceId || !homeworkState.assigningHomework?.id) return
    if (!ensureCanManageSpace()) return
    const userId = Number(homeworkState.homeworkTargetUserId.trim())
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户 ID')
      return
    }

    try {
      setError('')
      homeworkState.setHomeworkActionMessage('')
      homeworkState.setHomeworkTargetSubmitting(true)
      await api.addHomeworkTarget(selectedSpaceId, homeworkState.assigningHomework.id, userId)
      homeworkState.setHomeworkTargetUserId('')
      await refreshSpaceData(selectedSpaceId)
      homeworkState.setHomeworkActionMessage(`已将用户 #${userId} 添加到作业 #${homeworkState.assigningHomework.id}`)
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
