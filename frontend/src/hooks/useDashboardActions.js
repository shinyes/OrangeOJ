import useHomeworkActions from './useHomeworkActions'
import useMemberActions from './useMemberActions'
import useProblemActions from './useProblemActions'
import useSystemActions from './useSystemActions'
import useTrainingActions from './useTrainingActions'

export default function useDashboardActions({
  selectedSpaceId,
  canManageSelectedSpace,
  registrationEnabled,
  refreshSpaces,
  refreshSpaceData,
  refreshSpaceMemberData,
  setRegistrationEnabled,
  setError,
  normalizeLanguage,
  problemState,
  trainingState,
  homeworkState,
  memberState,
  systemState,
  passwordState,
  batchState,
  modalState
}) {
  const ensureCanManageSpace = () => {
    if (canManageSelectedSpace) return true
    setError('当前账号为普通成员，无空间管理权限')
    return false
  }

  const problemActions = useProblemActions({
    selectedSpaceId,
    ensureCanManageSpace,
    setError,
    refreshSpaceData,
    problemState,
    modalState
  })

  const trainingActions = useTrainingActions({
    selectedSpaceId,
    ensureCanManageSpace,
    setError,
    refreshSpaceData,
    trainingState,
    modalState
  })

  const homeworkActions = useHomeworkActions({
    selectedSpaceId,
    ensureCanManageSpace,
    setError,
    refreshSpaceData,
    homeworkState,
    modalState
  })

  const memberActions = useMemberActions({
    selectedSpaceId,
    ensureCanManageSpace,
    setError,
    refreshSpaces,
    refreshSpaceMemberData,
    memberState
  })

  const systemActions = useSystemActions({
    selectedSpaceId,
    ensureCanManageSpace,
    registrationEnabled,
    setRegistrationEnabled,
    refreshSpaces,
    setError,
    normalizeLanguage,
    systemState,
    passwordState,
    batchState,
    modalState
  })

  return {
    ...problemActions,
    ...trainingActions,
    ...homeworkActions,
    ...memberActions,
    ...systemActions
  }
}
