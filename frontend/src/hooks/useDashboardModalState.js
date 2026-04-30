import { useEffect, useState } from 'react'

export default function useDashboardModalState({ selectedSpace, selectedSpaceId, canManageSelectedSpace, normalizeLanguage }) {
  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceDesc, setNewSpaceDesc] = useState('')
  const [spaceSettingsName, setSpaceSettingsName] = useState('')
  const [spaceSettingsDescription, setSpaceSettingsDescription] = useState('')
  const [spaceDefaultLanguage, setSpaceDefaultLanguage] = useState('cpp')
  const [spaceSettingsSubmitting, setSpaceSettingsSubmitting] = useState(false)
  const [spaceSettingsMessage, setSpaceSettingsMessage] = useState('')
  const [editingProblemId, setEditingProblemId] = useState(null)
  const [editingSpaceProblem, setEditingSpaceProblem] = useState(null)
  const [editingTrainingPlan, setEditingTrainingPlan] = useState(null)
  const [assigningTrainingPlan, setAssigningTrainingPlan] = useState(null)
  const [trainingParticipantUserId, setTrainingParticipantUserId] = useState('')
  const [trainingParticipantSubmitting, setTrainingParticipantSubmitting] = useState(false)
  const [editingHomework, setEditingHomework] = useState(null)
  const [assigningHomework, setAssigningHomework] = useState(null)
  const [homeworkTargetUserId, setHomeworkTargetUserId] = useState('')
  const [homeworkTargetSubmitting, setHomeworkTargetSubmitting] = useState(false)
  const [batchInput, setBatchInput] = useState('')
  const [batchSpaceId, setBatchSpaceId] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchResult, setBatchResult] = useState(null)
  const [adminResetUserId, setAdminResetUserId] = useState('')
  const [adminResetSubmitting, setAdminResetSubmitting] = useState(false)
  const [adminResetMessage, setAdminResetMessage] = useState('')
  const [activeConfigModal, setActiveConfigModal] = useState('')

  const openConfigModal = (modalType) => {
    setActiveConfigModal(modalType)
  }

  const closeConfigModal = () => {
    if (activeConfigModal === 'edit-space-problem') {
      setEditingProblemId(null)
      setEditingSpaceProblem(null)
    }
    if (activeConfigModal === 'create-training-plan' || activeConfigModal === 'edit-training-plan') {
      setEditingTrainingPlan(null)
    }
    if (activeConfigModal === 'assign-training-participant') {
      setAssigningTrainingPlan(null)
      setTrainingParticipantUserId('')
      setTrainingParticipantSubmitting(false)
    }
    if (activeConfigModal === 'create-homework' || activeConfigModal === 'edit-homework') {
      setEditingHomework(null)
    }
    if (activeConfigModal === 'assign-homework-target') {
      setAssigningHomework(null)
      setHomeworkTargetUserId('')
      setHomeworkTargetSubmitting(false)
    }
    setActiveConfigModal('')
  }

  useEffect(() => {
    setSpaceSettingsName(selectedSpace?.name || '')
    setSpaceSettingsDescription(selectedSpace?.description || '')
    setSpaceDefaultLanguage(normalizeLanguage(selectedSpace?.defaultProgrammingLanguage || 'cpp'))
    setSpaceSettingsMessage('')
    setEditingProblemId(null)
    setEditingSpaceProblem(null)
    setEditingTrainingPlan(null)
    setAssigningTrainingPlan(null)
    setTrainingParticipantUserId('')
    setTrainingParticipantSubmitting(false)
    setEditingHomework(null)
    setAssigningHomework(null)
    setHomeworkTargetUserId('')
    setHomeworkTargetSubmitting(false)
    setActiveConfigModal('')
  }, [selectedSpaceId, canManageSelectedSpace, selectedSpace, normalizeLanguage])

  return {
    newSpaceName,
    setNewSpaceName,
    newSpaceDesc,
    setNewSpaceDesc,
    spaceSettingsName,
    setSpaceSettingsName,
    spaceSettingsDescription,
    setSpaceSettingsDescription,
    spaceDefaultLanguage,
    setSpaceDefaultLanguage,
    spaceSettingsSubmitting,
    setSpaceSettingsSubmitting,
    spaceSettingsMessage,
    setSpaceSettingsMessage,
    editingProblemId,
    setEditingProblemId,
    editingSpaceProblem,
    setEditingSpaceProblem,
    editingTrainingPlan,
    setEditingTrainingPlan,
    assigningTrainingPlan,
    setAssigningTrainingPlan,
    trainingParticipantUserId,
    setTrainingParticipantUserId,
    trainingParticipantSubmitting,
    setTrainingParticipantSubmitting,
    editingHomework,
    setEditingHomework,
    assigningHomework,
    setAssigningHomework,
    homeworkTargetUserId,
    setHomeworkTargetUserId,
    homeworkTargetSubmitting,
    setHomeworkTargetSubmitting,
    batchInput,
    setBatchInput,
    batchSpaceId,
    setBatchSpaceId,
    batchSubmitting,
    setBatchSubmitting,
    batchResult,
    setBatchResult,
    adminResetUserId,
    setAdminResetUserId,
    adminResetSubmitting,
    setAdminResetSubmitting,
    adminResetMessage,
    setAdminResetMessage,
    activeConfigModal,
    openConfigModal,
    closeConfigModal
  }
}
