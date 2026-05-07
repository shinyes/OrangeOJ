import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { selectedSpaceStorageKey } from '../utils/userScopedStorage'

function readStoredSelectedSpaceId(storageKey) {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(storageKey)
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export default function useDashboardData({
  user,
  isSystemAdmin,
  isLearnView,
  isSpaceManageView,
  locationSearch,
  setError,
  spaceProblemSearch,
  learningProblemSearch,
  learningTrainingSearch,
  learningHomeworkSearch,
  memberCandidateInput
}) {
  const selectedSpaceKey = useMemo(() => selectedSpaceStorageKey(user), [user?.id, user?.userId, user?.username])
  const [spaces, setSpaces] = useState([])
  const [selectedSpaceId, setSelectedSpaceId] = useState(() => readStoredSelectedSpaceId(selectedSpaceKey))
  const [spaceTab, setSpaceTab] = useState('problems')
  const [spaceManageTab, setSpaceManageTab] = useState('settings')
  const [systemTab, setSystemTab] = useState('settings')
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [spaceProblems, setSpaceProblems] = useState([])
  const [trainingPlans, setTrainingPlans] = useState([])
  const [homeworks, setHomeworks] = useState([])
  const [spaceMembers, setSpaceMembers] = useState([])
  const [memberCandidates, setMemberCandidates] = useState([])
  const [memberSearchLoading, setMemberSearchLoading] = useState(false)

  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === selectedSpaceId) || null,
    [spaces, selectedSpaceId]
  )
  const hasAnySpaceAdminRole = useMemo(
    () => isSystemAdmin || spaces.some((space) => space.myRole === 'space_admin'),
    [isSystemAdmin, spaces]
  )
  const isSpaceAdminOfSelectedSpace = Boolean(selectedSpace && selectedSpace.myRole === 'space_admin')
  const canManageSelectedSpace = isSystemAdmin || isSpaceAdminOfSelectedSpace

  const filteredSpaceProblems = useMemo(() => {
    const keyword = spaceProblemSearch.trim().toLowerCase()
    if (!keyword) return spaceProblems
    return spaceProblems.filter((problem) => {
      const tagsText = Array.isArray(problem.tags) ? problem.tags.join(' ').toLowerCase() : ''
      return (
        String(problem.id).includes(keyword) ||
        String(problem.title || '').toLowerCase().includes(keyword) ||
        tagsText.includes(keyword)
      )
    })
  }, [spaceProblemSearch, spaceProblems])

  const filteredLearningProblems = useMemo(() => {
    const keyword = learningProblemSearch.trim().toLowerCase()
    if (!keyword) return spaceProblems
    return spaceProblems.filter((problem) => {
      const tagsText = Array.isArray(problem.tags) ? problem.tags.join(' ').toLowerCase() : ''
      return (
        String(problem.id).includes(keyword) ||
        String(problem.title || '').toLowerCase().includes(keyword) ||
        tagsText.includes(keyword)
      )
    })
  }, [learningProblemSearch, spaceProblems])

  const filteredLearningTrainingPlans = useMemo(() => {
    const keyword = learningTrainingSearch.trim().toLowerCase()
    if (!keyword) return trainingPlans
    return trainingPlans.filter((plan) => String(plan.title || '').toLowerCase().includes(keyword))
  }, [learningTrainingSearch, trainingPlans])

  const filteredLearningHomeworks = useMemo(() => {
    const keyword = learningHomeworkSearch.trim().toLowerCase()
    if (!keyword) return homeworks
    return homeworks.filter((homework) => String(homework.title || '').toLowerCase().includes(keyword))
  }, [learningHomeworkSearch, homeworks])

  const requestedSpaceId = useMemo(() => {
    const raw = new URLSearchParams(locationSearch).get('spaceId')
    const parsed = Number(raw)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }, [locationSearch])

  const requestedSpaceTab = useMemo(() => {
    const raw = new URLSearchParams(locationSearch).get('tab')
    return ['problems', 'training', 'homework'].includes(raw) ? raw : ''
  }, [locationSearch])

  const refreshSpaces = useCallback(async () => {
    const list = await api.listSpaces()
    setSpaces(list)
    setSelectedSpaceId((currentSelectedSpaceId) => {
      if (!currentSelectedSpaceId && list.length > 0) {
        return list[0].id
      }
      if (currentSelectedSpaceId && !list.find((space) => space.id === currentSelectedSpaceId)) {
        return list.length > 0 ? list[0].id : null
      }
      return currentSelectedSpaceId
    })
  }, [])

  const refreshAdminData = useCallback(async () => {
    if (!isSystemAdmin) return
    const registration = await api.getRegistration()
    setRegistrationEnabled(Boolean(registration?.enabled))
  }, [isSystemAdmin])

  const refreshSpaceData = useCallback(async (spaceId) => {
    if (!spaceId) {
      setSpaceProblems([])
      setTrainingPlans([])
      setHomeworks([])
      return
    }
    const [problems, plans, hw] = await Promise.all([
      api.listSpaceProblems(spaceId),
      api.listTrainingPlans(spaceId),
      api.listHomeworks(spaceId)
    ])
    setSpaceProblems(problems || [])
    setTrainingPlans(plans || [])
    setHomeworks(hw || [])
  }, [])

  const refreshSpaceMemberData = useCallback(async (spaceId) => {
    if (!spaceId) {
      setSpaceMembers([])
      return
    }
    const list = await api.listSpaceMembers(spaceId)
    setSpaceMembers(list || [])
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        await refreshSpaces()
        await refreshAdminData()
      } catch (err) {
        setError(err.message || '加载失败')
      }
    })()
  }, [refreshSpaces, refreshAdminData, setError])

  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        await refreshSpaceData(selectedSpaceId)
      } catch (err) {
        setError(err.message || '加载空间数据失败')
      }
    })()
  }, [refreshSpaceData, selectedSpaceId, setError])

  useEffect(() => {
    if (!isLearnView || !requestedSpaceId) return
    if (spaces.some((space) => space.id === requestedSpaceId)) {
      setSelectedSpaceId(requestedSpaceId)
    }
  }, [isLearnView, requestedSpaceId, spaces])

  useEffect(() => {
    setSelectedSpaceId(readStoredSelectedSpaceId(selectedSpaceKey))
  }, [selectedSpaceKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selectedSpaceId) {
      window.localStorage.setItem(selectedSpaceKey, String(selectedSpaceId))
      return
    }
    window.localStorage.removeItem(selectedSpaceKey)
  }, [selectedSpaceId, selectedSpaceKey])

  useEffect(() => {
    if (!isLearnView || !requestedSpaceTab) return
    setSpaceTab(requestedSpaceTab)
  }, [isLearnView, requestedSpaceTab])

  useEffect(() => {
    ;(async () => {
      try {
        if (!selectedSpaceId || !canManageSelectedSpace) {
          setSpaceMembers([])
          return
        }
        await refreshSpaceMemberData(selectedSpaceId)
      } catch (err) {
        if (isSpaceManageView) {
          setError(err.message || '加载空间成员失败')
        }
      }
    })()
  }, [selectedSpaceId, canManageSelectedSpace, isSpaceManageView, refreshSpaceMemberData, setError])

  useEffect(() => {
    if (!selectedSpaceId || !canManageSelectedSpace) {
      setMemberCandidates([])
      setMemberSearchLoading(false)
      return
    }
    const keyword = memberCandidateInput.trim()
    if (!keyword) {
      setMemberCandidates([])
      setMemberSearchLoading(false)
      return
    }

    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setMemberSearchLoading(true)
        const list = await api.searchSpaceMemberCandidates(selectedSpaceId, keyword)
        if (!active) return
        setMemberCandidates(list || [])
      } catch (err) {
        if (!active) return
        setMemberCandidates([])
        setError(err.message || '搜索用户失败')
      } finally {
        if (active) {
          setMemberSearchLoading(false)
        }
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [selectedSpaceId, canManageSelectedSpace, memberCandidateInput, setError])

  return {
    spaces,
    selectedSpaceId,
    setSelectedSpaceId,
    spaceTab,
    setSpaceTab,
    spaceManageTab,
    setSpaceManageTab,
    systemTab,
    setSystemTab,
    registrationEnabled,
    setRegistrationEnabled,
    spaceProblems,
    trainingPlans,
    homeworks,
    spaceMembers,
    memberCandidates,
    setMemberCandidates,
    memberSearchLoading,
    selectedSpace,
    hasAnySpaceAdminRole,
    canManageSelectedSpace,
    filteredSpaceProblems,
    filteredLearningProblems,
    filteredLearningTrainingPlans,
    filteredLearningHomeworks,
    refreshSpaces,
    refreshSpaceData,
    refreshSpaceMemberData,
    setSpaceMembers
  }
}
