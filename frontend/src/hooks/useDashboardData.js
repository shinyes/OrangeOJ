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

  learningTrainingSearch,
  learningPracticeSearch,
  memberCandidateInput
}) {
  const selectedSpaceKey = useMemo(() => selectedSpaceStorageKey(user), [user?.id, user?.userId, user?.username])
  const [spaces, setSpaces] = useState([])
  const [selectedSpaceId, setSelectedSpaceId] = useState(() => readStoredSelectedSpaceId(selectedSpaceKey))
  const [spaceTab, setSpaceTab] = useState('training')
  const [spaceManageTab, setSpaceManageTab] = useState('settings')
  const [systemTab, setSystemTab] = useState('settings')
  const [learningTrainingTag, setLearningTrainingTag] = useState('')
  const [learningPracticeTag, setLearningPracticeTag] = useState('')
  const [registrationEnabled, setRegistrationEnabled] = useState(false)
  const [spaceProblems, setSpaceProblems] = useState([])
  const [trainingPlans, setTrainingPlans] = useState([])
  const [practices, setPractices] = useState([])
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

    const allTrainingTags = useMemo(() => {
    const tagSet = new Set()
    trainingPlans.forEach((plan) => {
      if (Array.isArray(plan.tags)) plan.tags.forEach((t) => tagSet.add(t))
    })
    return [...tagSet].sort((a, b) => a.localeCompare(b))
  }, [trainingPlans])

  const allPracticeTags = useMemo(() => {
    const tagSet = new Set()
    practices.forEach((hw) => {
      if (Array.isArray(hw.tags)) hw.tags.forEach((t) => tagSet.add(t))
    })
    return [...tagSet].sort((a, b) => a.localeCompare(b))
  }, [practices])

  const filteredLearningTrainingPlans = useMemo(() => {
    const keyword = learningTrainingSearch.trim().toLowerCase()
    return trainingPlans.filter((plan) => {
      if (keyword && !String(plan.title || '').toLowerCase().includes(keyword)) return false
      if (learningTrainingTag && !(Array.isArray(plan.tags) && plan.tags.includes(learningTrainingTag))) return false
      return true
    })
  }, [learningTrainingSearch, learningTrainingTag, trainingPlans])

  const filteredLearningPractices = useMemo(() => {
    const keyword = learningPracticeSearch.trim().toLowerCase()
    return practices.filter((practice) => {
      if (keyword && !String(practice.title || '').toLowerCase().includes(keyword)) return false
      if (learningPracticeTag && !(Array.isArray(practice.tags) && practice.tags.includes(learningPracticeTag))) return false
      return true
    })
  }, [learningPracticeSearch, learningPracticeTag, practices])

  const requestedSpaceId = useMemo(() => {
    const raw = new URLSearchParams(locationSearch).get('spaceId')
    const parsed = Number(raw)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }, [locationSearch])

  const requestedSpaceTab = useMemo(() => {
    const raw = new URLSearchParams(locationSearch).get('tab')
    return ['training', 'practice'].includes(raw) ? raw : ''
  }, [locationSearch])

  const requestedSpaceManageTab = useMemo(() => {
    const raw = new URLSearchParams(locationSearch).get('mtab')
    return ['settings', 'members'].includes(raw) ? raw : ''
  }, [locationSearch])

  const requestedSystemTab = useMemo(() => {
    const raw = new URLSearchParams(locationSearch).get('stab')
    return ['settings', 'account', 'batch'].includes(raw) ? raw : ''
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
      setPractices([])
      return
    }
    const [problems, plans, hw] = await Promise.all([
      api.listSpaceProblems(spaceId),
      api.listTrainingPlans(spaceId),
      api.listPractices(spaceId)
    ])
    setSpaceProblems(problems || [])
    setTrainingPlans(plans || [])
    setPractices(hw || [])
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
    if (requestedSpaceManageTab) setSpaceManageTab(requestedSpaceManageTab)
  }, [requestedSpaceManageTab])

  useEffect(() => {
    if (requestedSystemTab) setSystemTab(requestedSystemTab)
  }, [requestedSystemTab])

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
    practices,
    spaceMembers,
    memberCandidates,
    setMemberCandidates,
    memberSearchLoading,
    selectedSpace,
    hasAnySpaceAdminRole,
    canManageSelectedSpace,
    filteredSpaceProblems,
    allTrainingTags,
    allPracticeTags,
    learningTrainingTag,
    setLearningTrainingTag,
    learningPracticeTag,
    setLearningPracticeTag,
    filteredLearningTrainingPlans,
    filteredLearningPractices,
    refreshSpaces,
    refreshSpaceData,
    refreshSpaceMemberData,
    setSpaceMembers
  }
}
