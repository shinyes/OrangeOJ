import { api } from '../api'

export default function useTrainingActions({
  selectedSpaceId,
  ensureCanManageSpace,
  setError,
  refreshSpaceData,
  trainingState,
  modalState
}) {
  const openCreateTrainingPlanModal = () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    trainingState.setEditingTrainingPlan(null)
    modalState.openConfigModal('create-training-plan')
  }

  const openAssignTrainingParticipantModal = (planId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const plan = trainingState.trainingPlans.find((item) => item.id === planId)
    if (!plan) {
      setError('训练计划不存在')
      return
    }
    trainingState.setAssigningTrainingPlan(plan)
    trainingState.setTrainingParticipantUserId('')
    modalState.openConfigModal('assign-training-participant')
  }

  const createTrainingPlan = async (planData) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      trainingState.setTrainingActionMessage('')
      await api.createTrainingPlan(selectedSpaceId, planData)
      await refreshSpaceData(selectedSpaceId)
      trainingState.setTrainingActionMessage('训练计划创建成功')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const openEditTrainingPlan = async (planId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      const detail = await api.getTrainingPlan(selectedSpaceId, planId)
      trainingState.setEditingTrainingPlan(detail)
      modalState.openConfigModal('edit-training-plan')
    } catch (err) {
      setError(err.message || '加载训练详情失败')
    }
  }

  const saveEditedTrainingPlan = async (planData) => {
    if (!selectedSpaceId || !trainingState.editingTrainingPlan?.id) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      trainingState.setTrainingActionMessage('')
      await api.updateTrainingPlan(selectedSpaceId, trainingState.editingTrainingPlan.id, planData)
      await refreshSpaceData(selectedSpaceId)
      trainingState.setTrainingActionMessage('训练计划保存成功')
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const deleteTrainingPlan = async (planId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!window.confirm(`确认删除训练计划 #${planId} 吗？`)) {
      return
    }
    try {
      setError('')
      trainingState.setTrainingActionMessage('')
      await api.deleteTrainingPlan(selectedSpaceId, planId)
      if (trainingState.editingTrainingPlan?.id === planId) {
        trainingState.setEditingTrainingPlan(null)
      }
      await refreshSpaceData(selectedSpaceId)
      trainingState.setTrainingActionMessage('训练计划删除成功')
    } catch (err) {
      setError(err.message)
    }
  }

  const joinTrainingPlan = async (planId) => {
    if (!selectedSpaceId) return
    try {
      setError('')
      trainingState.setTrainingActionMessage('')
      await api.joinTrainingPlan(selectedSpaceId, planId)
      await refreshSpaceData(selectedSpaceId)
      trainingState.setTrainingActionMessage('已加入训练计划')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddTrainingParticipant = async () => {
    if (!selectedSpaceId || !trainingState.assigningTrainingPlan?.id) return
    if (!ensureCanManageSpace()) return

    const userId = Number(trainingState.trainingParticipantUserId.trim())
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户 ID')
      return
    }

    try {
      setError('')
      trainingState.setTrainingActionMessage('')
      trainingState.setTrainingParticipantSubmitting(true)
      await api.addTrainingPlanParticipant(selectedSpaceId, trainingState.assigningTrainingPlan.id, userId)
      trainingState.setTrainingParticipantUserId('')
      await refreshSpaceData(selectedSpaceId)
      trainingState.setTrainingActionMessage(`已将用户 #${userId} 添加到训练 #${trainingState.assigningTrainingPlan.id}`)
      modalState.closeConfigModal()
    } catch (err) {
      setError(err.message || '分配训练成员失败')
    } finally {
      trainingState.setTrainingParticipantSubmitting(false)
    }
  }

  return {
    openCreateTrainingPlanModal,
    openAssignTrainingParticipantModal,
    createTrainingPlan,
    openEditTrainingPlan,
    saveEditedTrainingPlan,
    deleteTrainingPlan,
    joinTrainingPlan,
    handleAddTrainingParticipant
  }
}
