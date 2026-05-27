import { api } from '../api'

function countTrainingProblemIds(plan) {
  const ids = new Set()
  const chapters = Array.isArray(plan?.chapters) ? plan.chapters : []
  chapters.forEach((chapter) => {
    const items = Array.isArray(chapter?.items) ? chapter.items : []
    items.forEach((item) => {
      const id = Number(item?.problemId)
      if (Number.isInteger(id) && id > 0) {
        ids.add(id)
      }
    })
  })
  return ids.size
}

export default function useTrainingActions({
  selectedSpaceId,
  ensureCanManageSpace,
  setError,
  refreshSpaceData,
  trainingState,
  modalState,
  confirmAction
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
    const plan = trainingState.trainingPlans.find((item) => item.id === planId)
    const planLabel = plan?.title ? `「${plan.title}」(#${planId})` : `#${planId}`
    const confirmed = await confirmAction({
      title: '删除训练计划',
      message: `确认删除训练计划 ${planLabel} 吗？`,
      confirmText: '删除训练',
      cancelText: '取消',
      confirmColor: 'error'
    })
    if (!confirmed) {
      return
    }
    try {
      setError('')
      trainingState.setTrainingActionMessage('')
      const detail = await api.getTrainingPlan(selectedSpaceId, planId)
      const associatedProblemCount = countTrainingProblemIds(detail)
      const deleteProblems = associatedProblemCount > 0
        ? await confirmAction({
            title: '删除关联题目',
            message: `是否同时从题库删除该训练关联的 ${associatedProblemCount} 道题目？\n\n会删除不再被其他作业或训练引用的关联题目，并连带清理提交记录。\n选择“仅删除训练”会保留题目。`,
            confirmText: '同时删除题目',
            cancelText: '仅删除训练',
            confirmColor: 'error'
          })
        : false
      const result = await api.deleteTrainingPlan(selectedSpaceId, planId, { deleteProblems })
      if (trainingState.editingTrainingPlan?.id === planId) {
        trainingState.setEditingTrainingPlan(null)
      }
      await refreshSpaceData(selectedSpaceId)
      if (deleteProblems) {
        const deletedProblemCount = Number(result?.deletedProblemCount || 0)
        const retainedProblemCount = Math.max(Number(result?.associatedProblemCount || associatedProblemCount) - deletedProblemCount, 0)
        if (deletedProblemCount > 0) {
          const retainedText = retainedProblemCount > 0 ? `，${retainedProblemCount} 道仍被其他作业或训练引用，已保留` : ''
          trainingState.setTrainingActionMessage(`训练计划删除成功，同时删除 ${deletedProblemCount} 道关联题目${retainedText}`)
        } else if (retainedProblemCount > 0) {
          trainingState.setTrainingActionMessage(`训练计划删除成功，${retainedProblemCount} 道关联题目仍被其他作业或训练引用，已保留`)
        } else {
          trainingState.setTrainingActionMessage('训练计划删除成功')
        }
      } else {
        trainingState.setTrainingActionMessage('训练计划删除成功')
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddTrainingParticipant = async (targetUsers = []) => {
    if (!selectedSpaceId || !trainingState.assigningTrainingPlan?.id) return
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
      trainingState.setTrainingActionMessage('')
      trainingState.setTrainingParticipantSubmitting(true)
      await Promise.all(uniqueUserIds.map((userId) => api.addTrainingPlanParticipant(selectedSpaceId, trainingState.assigningTrainingPlan.id, userId)))
      trainingState.setTrainingParticipantUserId('')
      await refreshSpaceData(selectedSpaceId)
      trainingState.setTrainingActionMessage(`已将 ${uniqueUserIds.length} 名用户添加到训练 #${trainingState.assigningTrainingPlan.id}`)
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
    handleAddTrainingParticipant
  }
}
