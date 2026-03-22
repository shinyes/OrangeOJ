import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, toFriendlyError } from '../api'

function asPretty(value) {
  return JSON.stringify(value, null, 2)
}

function defaultBody(type) {
  if (type === 'programming') {
    return {
      inputFormat: '请在此填写输入格式',
      outputFormat: '请在此填写输出格式',
      samples: [{ input: '', output: '' }],
      testCases: [{ input: '', output: '' }],
      starterCode: {
        cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n  return 0;\n}',
        python: 'print("hello")',
        go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("hello")\n}'
      }
    }
  }
  if (type === 'single_choice') {
    return { options: ['A', 'B', 'C', 'D'] }
  }
  return {}
}

function defaultAnswer(type) {
  if (type === 'single_choice') return { answer: 'A' }
  if (type === 'true_false') return { answer: true }
  return {}
}

function problemTypeText(type) {
  if (type === 'programming') return '编程题'
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  return type
}

function normalizeLanguage(language) {
  if (language === 'python') return 'python'
  if (language === 'go') return 'go'
  return 'cpp'
}

function parseBatchLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const normalized = line.replace(/，/g, ',')
      const commaIndex = normalized.indexOf(',')
      if (commaIndex < 0) {
        return { username: normalized.trim(), password: '' }
      }
      return {
        username: normalized.slice(0, commaIndex).trim(),
        password: normalized.slice(commaIndex + 1).trim()
      }
    })
}

function toBatchCopyText(batchResult) {
  if (!batchResult?.results?.length) return ''
  return batchResult.results.map((row) => {
    const username = row.username || '(空)'
    if (row.success) {
      return `第${row.index}行\t${username}\t成功\t用户ID: ${row.userId}`
    }
    return `第${row.index}行\t${username}\t失败\t原因: ${toFriendlyError(row.reason || '未知错误')}`
  }).join('\n')
}

export default function DashboardPage({ user, onLogout, view = 'learn' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isSystemAdmin = user.globalRole === 'system_admin'
  const isLearnView = view === 'learn'
  const isSpaceManageView = view === 'space-manage'
  const isRootManageView = view === 'root-manage'
  const isSystemManageView = view === 'system-manage'
  const roleText = isSystemAdmin ? '系统管理员' : '普通用户'
  const [error, setError] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  const [spaces, setSpaces] = useState([])
  const [selectedSpaceId, setSelectedSpaceId] = useState(null)
  const [spaceTab, setSpaceTab] = useState('problems')
  const [spaceSelectorKeyword, setSpaceSelectorKeyword] = useState('')
  const [spaceManageTab, setSpaceManageTab] = useState('settings')
  const [systemTab, setSystemTab] = useState('settings')

  const [rootProblems, setRootProblems] = useState([])
  const [spaceRootProblems, setSpaceRootProblems] = useState([])
  const [rootProblemSearch, setRootProblemSearch] = useState('')
  const [registrationEnabled, setRegistrationEnabled] = useState(false)

  const [spaceProblems, setSpaceProblems] = useState([])
  const [trainingPlans, setTrainingPlans] = useState([])
  const [homeworks, setHomeworks] = useState([])
  const [homeworkDetails, setHomeworkDetails] = useState({})
  const [expandedHomeworkId, setExpandedHomeworkId] = useState(null)
  const [homeworkTargetInputs, setHomeworkTargetInputs] = useState({})
  const [homeworkTargetSubmittingId, setHomeworkTargetSubmittingId] = useState(null)
  const [homeworkActionMessage, setHomeworkActionMessage] = useState('')

  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceDesc, setNewSpaceDesc] = useState('')
  const [spaceSettingsName, setSpaceSettingsName] = useState('')
  const [spaceSettingsDescription, setSpaceSettingsDescription] = useState('')
  const [spaceDefaultLanguage, setSpaceDefaultLanguage] = useState('cpp')
  const [spaceSettingsSubmitting, setSpaceSettingsSubmitting] = useState(false)
  const [spaceSettingsMessage, setSpaceSettingsMessage] = useState('')

  const [problemType, setProblemType] = useState('programming')
  const [problemTitle, setProblemTitle] = useState('')
  const [problemStatement, setProblemStatement] = useState('')
  const [problemBodyJson, setProblemBodyJson] = useState(asPretty(defaultBody('programming')))
  const [problemAnswerJson, setProblemAnswerJson] = useState(asPretty(defaultAnswer('programming')))
  const [spaceProblemType, setSpaceProblemType] = useState('programming')
  const [spaceProblemTitle, setSpaceProblemTitle] = useState('')
  const [spaceProblemStatement, setSpaceProblemStatement] = useState('')
  const [spaceProblemBodyJson, setSpaceProblemBodyJson] = useState(asPretty(defaultBody('programming')))
  const [spaceProblemAnswerJson, setSpaceProblemAnswerJson] = useState(asPretty(defaultAnswer('programming')))

  const [spaceProblemSearch, setSpaceProblemSearch] = useState('')
  const [editingProblemId, setEditingProblemId] = useState(null)
  const [editingProblemType, setEditingProblemType] = useState('programming')
  const [editingProblemTitle, setEditingProblemTitle] = useState('')
  const [editingProblemStatement, setEditingProblemStatement] = useState('')
  const [editingProblemBodyJson, setEditingProblemBodyJson] = useState(asPretty(defaultBody('programming')))
  const [editingProblemAnswerJson, setEditingProblemAnswerJson] = useState(asPretty(defaultAnswer('programming')))
  const [editingTimeLimitMs, setEditingTimeLimitMs] = useState('1000')
  const [editingMemoryLimitMiB, setEditingMemoryLimitMiB] = useState('256')
  const [editingProblemSubmitting, setEditingProblemSubmitting] = useState(false)
  const [learningProblemSearch, setLearningProblemSearch] = useState('')
  const [learningTrainingSearch, setLearningTrainingSearch] = useState('')
  const [learningHomeworkSearch, setLearningHomeworkSearch] = useState('')
  const [planTitle, setPlanTitle] = useState('')
  const [homeworkTitle, setHomeworkTitle] = useState('')
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState('member')
  const [memberSubmitting, setMemberSubmitting] = useState(false)
  const [memberMessage, setMemberMessage] = useState('')
  const [memberResetUserId, setMemberResetUserId] = useState('')
  const [memberResetSubmitting, setMemberResetSubmitting] = useState(false)
  const [memberResetMessage, setMemberResetMessage] = useState('')

  const [batchInput, setBatchInput] = useState('')
  const [batchSpaceId, setBatchSpaceId] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchResult, setBatchResult] = useState(null)
  const [adminResetUserId, setAdminResetUserId] = useState('')
  const [adminResetSubmitting, setAdminResetSubmitting] = useState(false)
  const [adminResetMessage, setAdminResetMessage] = useState('')

  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false)
  const [changePasswordMessage, setChangePasswordMessage] = useState('')
  const [activeConfigModal, setActiveConfigModal] = useState('')

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
  const linkedProblemIDSet = useMemo(
    () => new Set(spaceProblems.map((problem) => problem.id)),
    [spaceProblems]
  )
  const filteredSpaceRootProblems = useMemo(() => {
    const keyword = spaceProblemSearch.trim().toLowerCase()
    if (!keyword) return spaceRootProblems
    return spaceRootProblems.filter((problem) => {
      return String(problem.id).includes(keyword) || String(problem.title || '').toLowerCase().includes(keyword)
    })
  }, [spaceProblemSearch, spaceRootProblems])
  const filteredSpacesForManage = useMemo(() => {
    const keyword = spaceSelectorKeyword.trim().toLowerCase()
    if (!keyword) return spaces
    return spaces.filter((space) => String(space.name || '').toLowerCase().includes(keyword))
  }, [spaceSelectorKeyword, spaces])
  const filteredLearningProblems = useMemo(() => {
    const keyword = learningProblemSearch.trim().toLowerCase()
    if (!keyword) return spaceProblems
    return spaceProblems.filter((problem) => {
      return String(problem.id).includes(keyword) || String(problem.title || '').toLowerCase().includes(keyword)
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
  const filteredRootProblems = useMemo(() => {
    const keyword = rootProblemSearch.trim().toLowerCase()
    if (!keyword) return rootProblems
    return rootProblems.filter((problem) => {
      return String(problem.id).includes(keyword) || String(problem.title || '').toLowerCase().includes(keyword)
    })
  }, [rootProblemSearch, rootProblems])

  const refreshSpaces = async () => {
    const list = await api.listSpaces()
    setSpaces(list)
    if (!selectedSpaceId && list.length > 0) {
      setSelectedSpaceId(list[0].id)
    }
    if (selectedSpaceId && !list.find((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(list.length > 0 ? list[0].id : null)
    }
  }

  const refreshAdminData = async () => {
    if (!isSystemAdmin) return
    const [registration, problems] = await Promise.all([
      api.getRegistration(),
      api.listRootProblems()
    ])
    setRegistrationEnabled(Boolean(registration?.enabled))
    setRootProblems(problems || [])
  }

  const refreshSpaceData = async (spaceId) => {
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
  }

  const refreshSpaceRootProblemData = async (spaceId) => {
    if (!spaceId || !canManageSelectedSpace) {
      setSpaceRootProblems([])
      return
    }
    const list = await api.listSpaceRootProblems(spaceId)
    setSpaceRootProblems(list || [])
  }

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
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        await refreshSpaceData(selectedSpaceId)
      } catch (err) {
        setError(err.message || '加载空间数据失败')
      }
    })()
  }, [selectedSpaceId])

  useEffect(() => {
    ;(async () => {
      try {
        await refreshSpaceRootProblemData(selectedSpaceId)
      } catch (err) {
        if (isSpaceManageView) {
          setError(err.message || '加载根题库失败')
        }
      }
    })()
  }, [selectedSpaceId, canManageSelectedSpace, isSpaceManageView])

  useEffect(() => {
    setMemberMessage('')
    setMemberUserId('')
    setMemberRole('member')
    setMemberResetUserId('')
    setMemberResetMessage('')
    setExpandedHomeworkId(null)
    setHomeworkDetails({})
    setHomeworkTargetInputs({})
    setHomeworkActionMessage('')
    setSpaceSettingsName(selectedSpace?.name || '')
    setSpaceSettingsDescription(selectedSpace?.description || '')
    setSpaceDefaultLanguage(normalizeLanguage(selectedSpace?.defaultProgrammingLanguage || 'cpp'))
    setSpaceSettingsMessage('')
    setSpaceProblemSearch('')
    setEditingProblemId(null)
    setSpaceManageTab('settings')
    setLearningProblemSearch('')
    setLearningTrainingSearch('')
    setLearningHomeworkSearch('')
    setActiveConfigModal('')
  }, [selectedSpaceId, canManageSelectedSpace])

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!userMenuRef.current) return
      if (!userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false)
        setActiveConfigModal('')
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [])

  useEffect(() => {
    if (isSystemManageView) {
      setSystemTab('settings')
    }
  }, [isSystemManageView])

  const createSpace = async () => {
    if (!newSpaceName.trim()) {
      setError('空间名称不能为空')
      return
    }
    try {
      setError('')
      await api.createSpace({
        name: newSpaceName.trim(),
        description: newSpaceDesc.trim(),
        defaultProgrammingLanguage: 'cpp'
      })
      setNewSpaceName('')
      setNewSpaceDesc('')
      await refreshSpaces()
      closeConfigModal()
    } catch (err) {
      setError(err.message)
    }
  }

  const ensureCanManageSpace = () => {
    if (canManageSelectedSpace) return true
    setError('当前账号为普通成员，无空间管理权限')
    return false
  }

  const updateSpaceSettings = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!spaceSettingsName.trim()) {
      setError('空间名称不能为空')
      return
    }
    try {
      setError('')
      setSpaceSettingsMessage('')
      setSpaceSettingsSubmitting(true)
      await api.updateSpace(selectedSpaceId, {
        name: spaceSettingsName.trim(),
        description: spaceSettingsDescription.trim(),
        defaultProgrammingLanguage: normalizeLanguage(spaceDefaultLanguage)
      })
      setSpaceSettingsMessage('空间设置已保存')
      await refreshSpaces()
      closeConfigModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setSpaceSettingsSubmitting(false)
    }
  }

  const createRootProblem = async () => {
    if (!problemTitle.trim()) {
      setError('题目标题不能为空')
      return
    }
    try {
      setError('')
      await api.createRootProblem({
        type: problemType,
        title: problemTitle.trim(),
        statementMd: problemStatement,
        bodyJson: JSON.parse(problemBodyJson || '{}'),
        answerJson: JSON.parse(problemAnswerJson || '{}'),
        timeLimitMs: 1000,
        memoryLimitMiB: 256
      })
      setProblemTitle('')
      setProblemStatement('')
      await refreshAdminData()
      if (canManageSelectedSpace && selectedSpaceId) {
        await refreshSpaceRootProblemData(selectedSpaceId)
      }
      closeConfigModal()
    } catch (err) {
      setError(err.message)
    }
  }

  const createSpaceProblem = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!spaceProblemTitle.trim()) {
      setError('题目标题不能为空')
      return
    }
    try {
      setError('')
      await api.createSpaceProblem(selectedSpaceId, {
        type: spaceProblemType,
        title: spaceProblemTitle.trim(),
        statementMd: spaceProblemStatement,
        bodyJson: JSON.parse(spaceProblemBodyJson || '{}'),
        answerJson: JSON.parse(spaceProblemAnswerJson || '{}'),
        timeLimitMs: 1000,
        memoryLimitMiB: 256
      })
      setSpaceProblemTitle('')
      setSpaceProblemStatement('')
      await refreshSpaceData(selectedSpaceId)
      await refreshSpaceRootProblemData(selectedSpaceId)
      if (isSystemAdmin) {
        await refreshAdminData()
      }
      closeConfigModal()
    } catch (err) {
      setError(err.message)
    }
  }

  const addProblemToSpace = async (problemId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      await api.addSpaceProblem(selectedSpaceId, problemId)
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
    }
  }

  const removeSpaceProblem = async (problemId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      await api.deleteSpaceProblem(selectedSpaceId, problemId)
      await refreshSpaceData(selectedSpaceId)
      if (editingProblemId === problemId) {
        setEditingProblemId(null)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const openEditProblem = (problemId) => {
    const problem = spaceRootProblems.find((item) => item.id === problemId)
    if (!problem) {
      setError('题目详情尚未加载完成，请稍后重试')
      return
    }
    setEditingProblemId(problemId)
    setEditingProblemType(problem.type || 'programming')
    setEditingProblemTitle(problem.title || '')
    setEditingProblemStatement(problem.statementMd || '')
    setEditingProblemBodyJson(asPretty(problem.bodyJson || {}))
    setEditingProblemAnswerJson(asPretty(problem.answerJson || {}))
    setEditingTimeLimitMs(String(problem.timeLimitMs || 1000))
    setEditingMemoryLimitMiB(String(problem.memoryLimitMiB || 256))
    openConfigModal('edit-space-problem')
  }

  const saveEditedSpaceProblem = async () => {
    if (!selectedSpaceId || !editingProblemId) return
    if (!ensureCanManageSpace()) return
    if (!editingProblemTitle.trim()) {
      setError('题目标题不能为空')
      return
    }
    try {
      setError('')
      setEditingProblemSubmitting(true)
      await api.updateSpaceProblem(selectedSpaceId, editingProblemId, {
        type: editingProblemType,
        title: editingProblemTitle.trim(),
        statementMd: editingProblemStatement,
        bodyJson: JSON.parse(editingProblemBodyJson || '{}'),
        answerJson: JSON.parse(editingProblemAnswerJson || '{}'),
        timeLimitMs: Number(editingTimeLimitMs) > 0 ? Number(editingTimeLimitMs) : 1000,
        memoryLimitMiB: Number(editingMemoryLimitMiB) > 0 ? Number(editingMemoryLimitMiB) : 256
      })
      await refreshSpaceData(selectedSpaceId)
      await refreshSpaceRootProblemData(selectedSpaceId)
      if (isSystemAdmin) {
        await refreshAdminData()
      }
      setEditingProblemId(null)
      closeConfigModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setEditingProblemSubmitting(false)
    }
  }

  const createTrainingPlan = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!planTitle.trim()) {
      setError('训练计划标题不能为空')
      return
    }
    try {
      setError('')
      await api.createTrainingPlan(selectedSpaceId, {
        title: planTitle.trim(),
        allowSelfJoin: true,
        published: true,
        chapters: [
          {
            title: '第一章',
            orderNo: 1,
            problemIds: spaceProblems.slice(0, 3).map((item) => item.id)
          }
        ]
      })
      setPlanTitle('')
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
    }
  }

  const joinTrainingPlan = async (planId) => {
    if (!selectedSpaceId) return
    try {
      setError('')
      await api.joinTrainingPlan(selectedSpaceId, planId)
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
    }
  }

  const createHomework = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!homeworkTitle.trim()) {
      setError('作业标题不能为空')
      return
    }
    try {
      setError('')
      await api.createHomework(selectedSpaceId, {
        title: homeworkTitle.trim(),
        description: '系统自动生成作业',
        published: true,
        items: spaceProblems.slice(0, 3).map((item, index) => ({
          problemId: item.id,
          orderNo: index + 1,
          score: 100
        }))
      })
      setHomeworkTitle('')
      await refreshSpaceData(selectedSpaceId)
    } catch (err) {
      setError(err.message)
    }
  }

  const loadHomeworkDetail = async (homeworkId, forceReload = false) => {
    if (!selectedSpaceId || !homeworkId) return null
    if (!forceReload && homeworkDetails[homeworkId]) {
      return homeworkDetails[homeworkId]
    }
    const detail = await api.getHomework(selectedSpaceId, homeworkId)
    setHomeworkDetails((prev) => ({ ...prev, [homeworkId]: detail }))
    return detail
  }

  const toggleHomeworkDetail = async (homeworkId) => {
    if (expandedHomeworkId === homeworkId) {
      setExpandedHomeworkId(null)
      return
    }
    try {
      setError('')
      setHomeworkActionMessage('')
      setExpandedHomeworkId(homeworkId)
      await loadHomeworkDetail(homeworkId)
    } catch (err) {
      setError(err.message || '加载作业详情失败')
    }
  }

  const handleHomeworkTargetInputChange = (homeworkId, value) => {
    setHomeworkTargetInputs((prev) => ({ ...prev, [homeworkId]: value }))
  }

  const handleAddHomeworkTarget = async (homeworkId) => {
    if (!selectedSpaceId || !homeworkId) return
    if (!ensureCanManageSpace()) return

    const rawUserID = (homeworkTargetInputs[homeworkId] || '').trim()
    const userID = Number(rawUserID)
    if (!Number.isInteger(userID) || userID <= 0) {
      setError('请输入有效的用户ID')
      return
    }

    try {
      setError('')
      setHomeworkActionMessage('')
      setHomeworkTargetSubmittingId(homeworkId)
      await api.addHomeworkTarget(selectedSpaceId, homeworkId, userID)
      setHomeworkTargetInputs((prev) => ({ ...prev, [homeworkId]: '' }))
      setHomeworkActionMessage(`用户 #${userID} 已加入作业 #${homeworkId} 的目标名单`)
      await loadHomeworkDetail(homeworkId, true)
    } catch (err) {
      setError(err.message || '分配作业目标用户失败')
    } finally {
      setHomeworkTargetSubmittingId(null)
    }
  }

  const handleAddMember = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const userId = Number(memberUserId)
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户ID')
      return
    }
    if (memberRole !== 'member' && memberRole !== 'space_admin') {
      setError('请选择有效角色')
      return
    }

    try {
      setError('')
      setMemberMessage('')
      setMemberSubmitting(true)
      await api.addSpaceMember(selectedSpaceId, userId, memberRole)
      setMemberUserId('')
      setMemberMessage(`用户 #${userId} 已加入空间，角色：${memberRole === 'space_admin' ? '空间管理员' : '成员'}`)
      await refreshSpaces()
      closeConfigModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setMemberSubmitting(false)
    }
  }

  const handleResetSpaceMemberPassword = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const userId = Number(memberResetUserId)
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户ID')
      return
    }

    try {
      setError('')
      setMemberResetMessage('')
      setMemberResetSubmitting(true)
      await api.resetSpaceMemberPassword(selectedSpaceId, userId)
      setMemberResetUserId('')
      setMemberResetMessage(`用户 #${userId} 密码已重置为 123456`)
      closeConfigModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setMemberResetSubmitting(false)
    }
  }

  const toggleRegistration = async () => {
    try {
      setError('')
      const next = !registrationEnabled
      await api.setRegistration(next)
      setRegistrationEnabled(next)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAdminResetPassword = async () => {
    const userId = Number(adminResetUserId)
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户ID')
      return
    }
    try {
      setError('')
      setAdminResetMessage('')
      setAdminResetSubmitting(true)
      await api.adminResetUserPassword(userId)
      setAdminResetUserId('')
      setAdminResetMessage(`用户 #${userId} 密码已重置为 123456`)
      closeConfigModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdminResetSubmitting(false)
    }
  }

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      setError('请输入旧密码和新密码')
      return
    }
    if (newPassword.length < 6) {
      setError('新密码至少 6 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    try {
      setError('')
      setChangePasswordMessage('')
      setChangePasswordSubmitting(true)
      await api.changePassword({ oldPassword, newPassword })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setChangePasswordMessage('密码修改成功')
    } catch (err) {
      setError(err.message)
    } finally {
      setChangePasswordSubmitting(false)
    }
  }

  const handleBatchRegister = async () => {
    const items = parseBatchLines(batchInput)
    if (items.length === 0) {
      setError('请输入批量账号，格式为每行：用户名,密码')
      return
    }

    const payload = { items }
    if (batchSpaceId) {
      payload.spaceId = Number(batchSpaceId)
    }

    try {
      setError('')
      setBatchSubmitting(true)
      const result = await api.batchRegisterUsers(payload)
      setBatchResult(result)
      closeConfigModal()
    } catch (err) {
      setError(err.message)
    } finally {
      setBatchSubmitting(false)
    }
  }

  const copyBatchResult = async () => {
    const text = toBatchCopyText(batchResult)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setError('')
    } catch {
      setError('复制失败，请手动复制结果内容')
    }
  }

  const openConfigModal = (modalType) => {
    setError('')
    setActiveConfigModal(modalType)
  }

  const closeConfigModal = () => {
    if (activeConfigModal === 'edit-space-problem') {
      setEditingProblemId(null)
    }
    setActiveConfigModal('')
  }

  const navigateFromMenu = (path) => {
    setUserMenuOpen(false)
    navigate(path)
  }

  const renderTopbarSpaceSwitcher = (className = '') => (
    <div className={`topbar-space ${className}`.trim()}>
      <label className="space-switcher">
        <span>空间</span>
        <select
          value={selectedSpaceId ? String(selectedSpaceId) : ''}
          onChange={(event) => setSelectedSpaceId(event.target.value ? Number(event.target.value) : null)}
          disabled={spaces.length === 0}
        >
          {spaces.length === 0 ? (
            <option value="">暂无空间</option>
          ) : (
            spaces.map((space) => (
              <option key={space.id} value={String(space.id)}>{space.name}</option>
            ))
          )}
        </select>
      </label>
    </div>
  )

  const renderChangePasswordSection = () => (
    <section className="panel">
      <h2>修改密码</h2>
      <div className="password-form">
        <input
          type="password"
          placeholder="旧密码"
          value={oldPassword}
          onChange={(event) => setOldPassword(event.target.value)}
        />
        <input
          type="password"
          placeholder="新密码（至少 6 位）"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <input
          type="password"
          placeholder="确认新密码"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
        <div className="inline-form">
          <button disabled={changePasswordSubmitting} onClick={handleChangePassword}>
            {changePasswordSubmitting ? '提交中...' : '确认修改密码'}
          </button>
          <button className="ghost-btn btn-link" onClick={() => setChangePasswordOpen(false)}>取消</button>
        </div>
        {changePasswordMessage && <div className="ok-box">{changePasswordMessage}</div>}
      </div>
    </section>
  )

  const renderConfigModal = () => {
    if (!activeConfigModal) return null

    let title = ''
    let content = null

    if (activeConfigModal === 'create-space') {
      title = '新建空间'
      content = (
        <div className="config-form">
          <input
            placeholder="空间名称"
            value={newSpaceName}
            onChange={(event) => setNewSpaceName(event.target.value)}
          />
          <textarea
            placeholder="空间描述（可选）"
            value={newSpaceDesc}
            onChange={(event) => setNewSpaceDesc(event.target.value)}
          />
          <div className="inline-form">
            <button onClick={createSpace}>创建空间</button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    if (activeConfigModal === 'space-settings') {
      title = '编辑空间设置'
      content = (
        <div className="config-form">
          <input
            placeholder="空间名称"
            value={spaceSettingsName}
            onChange={(event) => setSpaceSettingsName(event.target.value)}
          />
          <textarea
            placeholder="空间描述"
            value={spaceSettingsDescription}
            onChange={(event) => setSpaceSettingsDescription(event.target.value)}
          />
          <label className="inline-field">
            默认编程语言
            <select value={spaceDefaultLanguage} onChange={(event) => setSpaceDefaultLanguage(event.target.value)}>
              <option value="cpp">C++</option>
              <option value="python">Python</option>
              <option value="go">Go</option>
            </select>
          </label>
          <div className="inline-form">
            <button disabled={spaceSettingsSubmitting} onClick={updateSpaceSettings}>
              {spaceSettingsSubmitting ? '保存中...' : '保存设置'}
            </button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    if (activeConfigModal === 'upload-space-problem') {
      title = '上传新题目（自动进入根题库并关联本空间）'
      content = (
        <div className="config-form">
          <label className="inline-field">
            题目类型
            <select
              value={spaceProblemType}
              onChange={(event) => {
                const nextType = event.target.value
                setSpaceProblemType(nextType)
                setSpaceProblemBodyJson(asPretty(defaultBody(nextType)))
                setSpaceProblemAnswerJson(asPretty(defaultAnswer(nextType)))
              }}
            >
              <option value="programming">编程题</option>
              <option value="single_choice">单选题</option>
              <option value="true_false">判断题</option>
            </select>
          </label>
          <input
            placeholder="题目标题"
            value={spaceProblemTitle}
            onChange={(event) => setSpaceProblemTitle(event.target.value)}
          />
          <textarea
            placeholder="题面描述（Markdown）"
            value={spaceProblemStatement}
            onChange={(event) => setSpaceProblemStatement(event.target.value)}
          />
          <label className="inline-field">
            题目主体 JSON
            <textarea
              className="mono"
              value={spaceProblemBodyJson}
              onChange={(event) => setSpaceProblemBodyJson(event.target.value)}
            />
          </label>
          <label className="inline-field">
            答案 JSON
            <textarea
              className="mono"
              value={spaceProblemAnswerJson}
              onChange={(event) => setSpaceProblemAnswerJson(event.target.value)}
            />
          </label>
          <div className="inline-form">
            <button onClick={createSpaceProblem}>上传并关联</button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    if (activeConfigModal === 'edit-space-problem') {
      title = editingProblemId ? `编辑题目 #${editingProblemId}` : '编辑题目'
      content = editingProblemId ? (
        <div className="config-form">
          <label className="inline-field">
            题目类型
            <select value={editingProblemType} onChange={(event) => setEditingProblemType(event.target.value)}>
              <option value="programming">编程题</option>
              <option value="single_choice">单选题</option>
              <option value="true_false">判断题</option>
            </select>
          </label>
          <input
            placeholder="题目标题"
            value={editingProblemTitle}
            onChange={(event) => setEditingProblemTitle(event.target.value)}
          />
          <textarea
            placeholder="题面描述（Markdown）"
            value={editingProblemStatement}
            onChange={(event) => setEditingProblemStatement(event.target.value)}
          />
          <label className="inline-field">
            时间限制（ms）
            <input
              type="number"
              min="1"
              value={editingTimeLimitMs}
              onChange={(event) => setEditingTimeLimitMs(event.target.value)}
            />
          </label>
          <label className="inline-field">
            内存限制（MiB）
            <input
              type="number"
              min="1"
              value={editingMemoryLimitMiB}
              onChange={(event) => setEditingMemoryLimitMiB(event.target.value)}
            />
          </label>
          <label className="inline-field">
            题目主体 JSON
            <textarea
              className="mono"
              value={editingProblemBodyJson}
              onChange={(event) => setEditingProblemBodyJson(event.target.value)}
            />
          </label>
          <label className="inline-field">
            答案 JSON
            <textarea
              className="mono"
              value={editingProblemAnswerJson}
              onChange={(event) => setEditingProblemAnswerJson(event.target.value)}
            />
          </label>
          <div className="inline-form">
            <button disabled={editingProblemSubmitting} onClick={saveEditedSpaceProblem}>
              {editingProblemSubmitting ? '保存中...' : '保存修改'}
            </button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      ) : (
        <p className="muted">请先从空间题目列表中选择需要编辑的题目。</p>
      )
    }

    if (activeConfigModal === 'add-space-member') {
      title = '添加成员/空间管理员'
      content = (
        <div className="config-form">
          <input
            type="number"
            min="1"
            placeholder="用户ID"
            value={memberUserId}
            onChange={(event) => setMemberUserId(event.target.value)}
          />
          <label className="inline-field">
            角色
            <select className="member-role-select" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>
              <option value="member">成员</option>
              <option value="space_admin">空间管理员</option>
            </select>
          </label>
          <div className="inline-form">
            <button disabled={memberSubmitting} onClick={handleAddMember}>
              {memberSubmitting ? '提交中...' : '确认添加'}
            </button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    if (activeConfigModal === 'reset-space-member-password') {
      title = '重置空间成员密码'
      content = (
        <div className="config-form">
          <input
            type="number"
            min="1"
            placeholder="用户ID"
            value={memberResetUserId}
            onChange={(event) => setMemberResetUserId(event.target.value)}
          />
          <div className="inline-form">
            <button disabled={memberResetSubmitting} onClick={handleResetSpaceMemberPassword}>
              {memberResetSubmitting ? '重置中...' : '重置为 123456'}
            </button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    if (activeConfigModal === 'create-root-problem') {
      title = '新建根题'
      content = (
        <div className="config-form">
          <label className="inline-field">
            题目类型
            <select
              value={problemType}
              onChange={(event) => {
                const nextType = event.target.value
                setProblemType(nextType)
                setProblemBodyJson(asPretty(defaultBody(nextType)))
                setProblemAnswerJson(asPretty(defaultAnswer(nextType)))
              }}
            >
              <option value="programming">编程题</option>
              <option value="single_choice">单选题</option>
              <option value="true_false">判断题</option>
            </select>
          </label>
          <input
            placeholder="题目标题"
            value={problemTitle}
            onChange={(event) => setProblemTitle(event.target.value)}
          />
          <textarea
            placeholder="题面描述（Markdown）"
            value={problemStatement}
            onChange={(event) => setProblemStatement(event.target.value)}
          />
          <label className="inline-field">
            题目主体 JSON
            <textarea
              className="mono"
              value={problemBodyJson}
              onChange={(event) => setProblemBodyJson(event.target.value)}
            />
          </label>
          <label className="inline-field">
            答案 JSON
            <textarea
              className="mono"
              value={problemAnswerJson}
              onChange={(event) => setProblemAnswerJson(event.target.value)}
            />
          </label>
          <div className="inline-form">
            <button onClick={createRootProblem}>创建根题</button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    if (activeConfigModal === 'admin-reset-password') {
      title = '重置任意用户密码'
      content = (
        <div className="config-form">
          <input
            type="number"
            min="1"
            placeholder="用户ID"
            value={adminResetUserId}
            onChange={(event) => setAdminResetUserId(event.target.value)}
          />
          <div className="inline-form">
            <button disabled={adminResetSubmitting} onClick={handleAdminResetPassword}>
              {adminResetSubmitting ? '重置中...' : '重置为 123456'}
            </button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    if (activeConfigModal === 'batch-register') {
      title = '批量注册用户'
      content = (
        <div className="config-form">
          <p className="muted">每行格式：<code>用户名,密码</code>，密码至少 6 位。</p>
          <textarea
            className="mono batch-input"
            value={batchInput}
            onChange={(event) => setBatchInput(event.target.value)}
            placeholder={'student01,123456\nstudent02,123456'}
          />
          <label className="inline-field">
            加入空间（可选）
            <select value={batchSpaceId} onChange={(event) => setBatchSpaceId(event.target.value)}>
              <option value="">不加入空间</option>
              {spaces.map((space) => (
                <option key={space.id} value={String(space.id)}>{space.name}</option>
              ))}
            </select>
          </label>
          <div className="inline-form">
            <button disabled={batchSubmitting} onClick={handleBatchRegister}>
              {batchSubmitting ? '处理中...' : '开始批量注册'}
            </button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    return (
      <div className="modal-mask" onClick={closeConfigModal}>
        <section className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
          <div className="modal-head">
            <h3>{title || '配置'}</h3>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>关闭</button>
          </div>
          <div className="modal-body">
            {content}
          </div>
        </section>
      </div>
    )
  }

  const renderLearningSection = () => (
    <main className="panel">
      {!selectedSpace ? (
        <p className="muted">{spaces.length === 0 ? '暂无可访问空间，请先创建或加入空间。' : '请选择一个空间。'}</p>
      ) : (
        <>
          <div className="summary-grid">
            <div className="summary-card">
              <span>题目数</span>
              <strong>{spaceProblems.length}</strong>
            </div>
            <div className="summary-card">
              <span>训练计划</span>
              <strong>{trainingPlans.length}</strong>
            </div>
            <div className="summary-card">
              <span>作业</span>
              <strong>{homeworks.length}</strong>
            </div>
            <div className="summary-card">
              <span>当前身份</span>
              <strong>{canManageSelectedSpace ? '空间管理员' : '普通成员'}</strong>
            </div>
          </div>

          {spaceTab === 'problems' && (
            <div className="tab-body">
              <div className="inline-form section-toolbar">
                <input
                  placeholder="搜索题目（ID/标题）"
                  value={learningProblemSearch}
                  onChange={(event) => setLearningProblemSearch(event.target.value)}
                />
              </div>
              {filteredLearningProblems.length === 0 && <p className="muted">没有匹配题目。</p>}
              {filteredLearningProblems.map((problem) => (
                <div className="list-item" key={problem.id}>
                  <div>
                    <strong>#{problem.id} {problem.title}</strong>
                    <p>{problemTypeText(problem.type)} | {problem.timeLimitMs}ms | {problem.memoryLimitMiB}MiB</p>
                  </div>
                  <div className="inline-form list-item-actions">
                    <Link to={`/spaces/${selectedSpaceId}/problems/${problem.id}/solve`} className="ghost-btn">去做题</Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {spaceTab === 'training' && (
            <div className="tab-body">
              <div className="inline-form section-toolbar">
                <input
                  placeholder="搜索训练计划标题"
                  value={learningTrainingSearch}
                  onChange={(event) => setLearningTrainingSearch(event.target.value)}
                />
                {canManageSelectedSpace && (
                  <>
                    <input
                      placeholder="训练计划标题"
                      value={planTitle}
                      onChange={(event) => setPlanTitle(event.target.value)}
                    />
                    <button onClick={createTrainingPlan}>创建训练计划</button>
                  </>
                )}
              </div>
              {filteredLearningTrainingPlans.length === 0 && <p className="muted">没有匹配的训练计划。</p>}
              {filteredLearningTrainingPlans.map((plan) => (
                <div className="list-item" key={plan.id}>
                  <div>
                    <strong>{plan.title}</strong>
                    <p>{plan.allowSelfJoin ? '允许主动参加' : '仅管理员分配'}</p>
                  </div>
                  <button onClick={() => joinTrainingPlan(plan.id)}>参加</button>
                </div>
              ))}
            </div>
          )}

          {spaceTab === 'homework' && (
            <div className="tab-body">
              <div className="inline-form section-toolbar">
                <input
                  placeholder="搜索作业标题"
                  value={learningHomeworkSearch}
                  onChange={(event) => setLearningHomeworkSearch(event.target.value)}
                />
                {canManageSelectedSpace && (
                  <>
                    <input
                      placeholder="作业标题"
                      value={homeworkTitle}
                      onChange={(event) => setHomeworkTitle(event.target.value)}
                    />
                    <button onClick={createHomework}>创建作业</button>
                  </>
                )}
              </div>
              {filteredLearningHomeworks.length === 0 && <p className="muted">没有匹配的作业。</p>}
              {filteredLearningHomeworks.map((hw) => {
                const detail = homeworkDetails[hw.id]
                const expanded = expandedHomeworkId === hw.id
                return (
                  <div className="list-item homework-item" key={hw.id}>
                    <div>
                      <strong>{hw.title}</strong>
                      <p>{hw.published ? '已发布' : '草稿'} {hw.dueAt ? `| 截止：${hw.dueAt}` : ''}</p>
                    </div>
                    <button className="ghost-btn" onClick={() => toggleHomeworkDetail(hw.id)}>
                      {expanded ? '收起详情' : '查看详情'}
                    </button>

                    {expanded && (
                      <div className="homework-detail">
                        {!detail ? (
                          <p className="muted">作业详情加载中...</p>
                        ) : (
                          <>
                            <p className="muted">题目数：{detail.items?.length || 0} | 目标用户数：{detail.targets?.length || 0}</p>
                            <div className="homework-target-list">
                              {(detail.targets || []).length === 0 ? (
                                <span className="muted">暂无目标用户</span>
                              ) : (
                                detail.targets.map((target) => (
                                  <span key={target.userId} className="target-chip">
                                    #{target.userId} {target.username}
                                  </span>
                                ))
                              )}
                            </div>
                          </>
                        )}

                        {canManageSelectedSpace && (
                          <div className="inline-form homework-target-form">
                            <input
                              type="number"
                              min="1"
                              placeholder="输入用户ID分配作业"
                              value={homeworkTargetInputs[hw.id] || ''}
                              onChange={(event) => handleHomeworkTargetInputChange(hw.id, event.target.value)}
                            />
                            <button
                              disabled={homeworkTargetSubmittingId === hw.id}
                              onClick={() => handleAddHomeworkTarget(hw.id)}
                            >
                              {homeworkTargetSubmittingId === hw.id ? '分配中...' : '添加目标用户'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {homeworkActionMessage && <div className="ok-box">{homeworkActionMessage}</div>}
            </div>
          )}
        </>
      )}
    </main>
  )

  const renderSpaceManageSection = () => (
    <div className="space-content-grid">
      {!hasAnySpaceAdminRole && (
        <section className="panel">
          <h2>空间管理</h2>
          <p className="muted">当前账号没有空间管理员权限。</p>
        </section>
      )}

      {hasAnySpaceAdminRole && (
        <>
          <section className="panel">
            <h2>选择空间</h2>
            <div className="space-manage-picker">
              <input
                placeholder="搜索空间名称"
                value={spaceSelectorKeyword}
                onChange={(event) => setSpaceSelectorKeyword(event.target.value)}
              />
              <select
                value={selectedSpaceId ? String(selectedSpaceId) : ''}
                onChange={(event) => setSelectedSpaceId(event.target.value ? Number(event.target.value) : null)}
                disabled={filteredSpacesForManage.length === 0}
              >
                {filteredSpacesForManage.length === 0 ? (
                  <option value="">暂无匹配空间</option>
                ) : (
                  filteredSpacesForManage.map((space) => (
                    <option key={space.id} value={String(space.id)}>
                      #{space.id} {space.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {isSystemAdmin && (
              <div className="inline-form section-toolbar">
                <button onClick={() => openConfigModal('create-space')}>新建空间</button>
              </div>
            )}
          </section>

          {selectedSpace && !canManageSelectedSpace && (
            <section className="panel">
              <h2>空间管理</h2>
              <p className="muted">当前账号不是该空间管理员，请切换到你管理的空间。</p>
            </section>
          )}

          {selectedSpace && canManageSelectedSpace && (
            <>
              <div className="tabs section-tabs">
                <button className={spaceManageTab === 'settings' ? 'active' : ''} onClick={() => setSpaceManageTab('settings')}>空间设置</button>
                <button className={spaceManageTab === 'problems' ? 'active' : ''} onClick={() => setSpaceManageTab('problems')}>题库设置</button>
                <button className={spaceManageTab === 'members' ? 'active' : ''} onClick={() => setSpaceManageTab('members')}>成员管理</button>
              </div>

              {spaceManageTab === 'settings' && (
                <section className="panel">
                  <h2>空间设置</h2>
                  <div className="panel-summary">
                    <div>
                      <strong>空间名称</strong>
                      <p className="muted">{selectedSpace?.name || '-'}</p>
                    </div>
                    <div>
                      <strong>空间描述</strong>
                      <p className="muted">{selectedSpace?.description || '暂无描述'}</p>
                    </div>
                    <div>
                      <strong>默认编程语言</strong>
                      <p className="muted">{normalizeLanguage(selectedSpace?.defaultProgrammingLanguage || 'cpp')}</p>
                    </div>
                    <div className="inline-form">
                      <button onClick={() => openConfigModal('space-settings')}>编辑空间设置</button>
                    </div>
                  </div>
                  {spaceSettingsMessage && <div className="ok-box">{spaceSettingsMessage}</div>}
                </section>
              )}

              {spaceManageTab === 'problems' && (
                <section className="panel">
                  <h2>空间题库设置</h2>
                  <div className="inline-form section-toolbar">
                    <button onClick={() => openConfigModal('upload-space-problem')}>上传新题目</button>
                  </div>
                  <div className="manage-grid">
                    <div className="problem-form">
                      <h3>从根题库添加到空间</h3>
                      <input
                        placeholder="按题目ID或标题搜索"
                        value={spaceProblemSearch}
                        onChange={(event) => setSpaceProblemSearch(event.target.value)}
                      />
                      <div className="problem-select-list">
                        {filteredSpaceRootProblems.length === 0 && <p className="muted">没有可显示的根题。</p>}
                        {filteredSpaceRootProblems.map((problem) => {
                          const linked = linkedProblemIDSet.has(problem.id)
                          return (
                            <div className="problem-select-item" key={problem.id}>
                              <div>
                                <strong>#{problem.id} {problem.title}</strong>
                                <p>{problemTypeText(problem.type)}</p>
                              </div>
                              <button disabled={linked} onClick={() => addProblemToSpace(problem.id)}>
                                {linked ? '已在空间题库' : '添加'}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="problem-form">
                    <h3>当前空间题目</h3>
                    {spaceProblems.length === 0 && <p className="muted">当前空间暂无题目。</p>}
                    {spaceProblems.map((problem) => (
                      <div className="list-item" key={problem.id}>
                        <div>
                          <strong>#{problem.id} {problem.title}</strong>
                          <p>{problemTypeText(problem.type)} | {problem.timeLimitMs}ms | {problem.memoryLimitMiB}MiB</p>
                        </div>
                        <div className="inline-form list-item-actions">
                          <Link to={`/spaces/${selectedSpaceId}/problems/${problem.id}/solve`} className="ghost-btn">去做题</Link>
                          <button className="ghost-btn btn-link" onClick={() => openEditProblem(problem.id)}>编辑题目</button>
                          <button className="danger" onClick={() => removeSpaceProblem(problem.id)}>从空间移除</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {editingProblemId && <p className="muted">题目编辑弹窗已打开。</p>}
                </section>
              )}

              {spaceManageTab === 'members' && (
                <section className="panel">
                  <h2>成员管理</h2>
                  <p className="muted">将已注册用户加入当前空间。请输入用户 ID，可设置为成员或空间管理员。</p>
                  <p className="muted">一个空间支持设置多个空间管理员。</p>
                  <div className="inline-form">
                    <button onClick={() => openConfigModal('add-space-member')}>添加成员/管理员</button>
                    <button className="ghost-btn btn-link" onClick={() => openConfigModal('reset-space-member-password')}>重置成员密码</button>
                  </div>
                  {memberMessage && <div className="ok-box">{memberMessage}</div>}
                  {memberResetMessage && <div className="ok-box">{memberResetMessage}</div>}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  )

  const renderRootProblemSection = () => (
    <section className="panel">
      <h2>根题库管理</h2>
      <div className="inline-form section-toolbar">
        <input
          placeholder="搜索根题（ID/标题）"
          value={rootProblemSearch}
          onChange={(event) => setRootProblemSearch(event.target.value)}
        />
        <button onClick={() => openConfigModal('create-root-problem')}>新建根题</button>
      </div>

      <div className="root-list">
        {filteredRootProblems.length === 0 && <p className="muted">没有匹配的题目。</p>}
        {filteredRootProblems.map((problem) => (
          <div className="list-item" key={problem.id}>
            <div>
              <strong>#{problem.id} {problem.title}</strong>
              <p>{problemTypeText(problem.type)} | {problem.timeLimitMs}ms | {problem.memoryLimitMiB}MiB</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )

  const renderSystemSection = () => (
    <div className="system-grid">
      <div className="tabs section-tabs">
        <button className={systemTab === 'settings' ? 'active' : ''} onClick={() => setSystemTab('settings')}>系统设置</button>
        <button className={systemTab === 'account' ? 'active' : ''} onClick={() => setSystemTab('account')}>账号维护</button>
        <button className={systemTab === 'batch' ? 'active' : ''} onClick={() => setSystemTab('batch')}>批量注册</button>
      </div>

      {systemTab === 'settings' && (
        <section className="panel">
          <h2>系统设置</h2>
          <div className="setting-row">
            <span>注册开关</span>
            <button onClick={toggleRegistration}>
              {registrationEnabled ? '已开启（点击关闭）' : '已关闭（点击开启）'}
            </button>
          </div>
        </section>
      )}

      {systemTab === 'account' && (
        <section className="panel">
          <h2>重置用户密码</h2>
          <p className="muted">系统管理员可将任意用户密码重置为 123456。</p>
          <div className="inline-form">
            <button onClick={() => openConfigModal('admin-reset-password')}>打开重置弹窗</button>
          </div>
          {adminResetMessage && <div className="ok-box">{adminResetMessage}</div>}
        </section>
      )}

      {systemTab === 'batch' && (
        <section className="panel">
          <h2>批量注册用户</h2>
          <p className="muted">通过弹窗录入批量账号，提交后结果会展示在下方。</p>
          <div className="inline-form">
            <button onClick={() => openConfigModal('batch-register')}>打开批量注册弹窗</button>
          </div>

          {batchResult && (
            <div className="batch-result-wrap">
              <div className="result-head">
                <strong>
                  总计 {batchResult.total} 条，成功 {batchResult.successCount} 条，失败 {batchResult.failureCount} 条
                </strong>
                <button className="ghost-btn" onClick={copyBatchResult}>复制结果</button>
              </div>
              <table className="result-table">
                <thead>
                  <tr>
                    <th>行号</th>
                    <th>用户名</th>
                    <th>结果</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {batchResult.results.map((row) => (
                    <tr key={row.index}>
                      <td>{row.index}</td>
                      <td>{row.username || '(空)'}</td>
                      <td>{row.success ? '成功' : '失败'}</td>
                      <td>{row.success ? `用户ID: ${row.userId}` : toFriendlyError(row.reason || '未知错误')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )

  const renderCurrentView = () => {
    if (isLearnView) return renderLearningSection()
    if (isSpaceManageView) return renderSpaceManageSection()

    if (isRootManageView) {
      if (!isSystemAdmin) {
        return (
          <section className="panel">
            <h2>根题库管理</h2>
            <p className="muted">当前账号无系统管理员权限。</p>
          </section>
        )
      }
      return renderRootProblemSection()
    }

    if (isSystemManageView) {
      if (!isSystemAdmin) {
        return (
          <section className="panel">
            <h2>系统管理</h2>
            <p className="muted">当前账号无系统管理员权限。</p>
          </section>
        )
      }
      return renderSystemSection()
    }

    return (
      <section className="panel">
        <p className="muted">未知页面。</p>
      </section>
    )
  }

  const pageTitle = isLearnView
    ? '学习主页'
    : isSpaceManageView
      ? '空间管理'
      : isRootManageView
        ? '根题库管理'
        : '系统管理'

  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-dot">O</span>
          <h1>OrangeOJ</h1>
        </div>
        {isLearnView ? renderTopbarSpaceSwitcher() : <div className="topbar-page-chip">{pageTitle}</div>}
        {isLearnView && (
          <div className="tabs topbar-center-tabs">
            <button className={spaceTab === 'problems' ? 'active' : ''} onClick={() => setSpaceTab('problems')}>题库</button>
            <button className={spaceTab === 'homework' ? 'active' : ''} onClick={() => setSpaceTab('homework')}>作业</button>
            <button className={spaceTab === 'training' ? 'active' : ''} onClick={() => setSpaceTab('training')}>训练</button>
          </div>
        )}
        <div className="header-actions" ref={userMenuRef}>
          <button
            className={`user-menu-trigger ${userMenuOpen ? 'open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            onClick={() => setUserMenuOpen((prev) => !prev)}
          >
            <span className="user-menu-text">
              <strong>{user.username}</strong>
              <small>{roleText}</small>
            </span>
            <span className="user-menu-caret">{userMenuOpen ? '^' : 'v'}</span>
          </button>
          {userMenuOpen && (
            <div className="user-menu-panel" role="menu">
              <div className="user-menu-meta">{user.username} · {roleText}</div>
              {location.pathname !== '/' && (
                <button className="user-menu-item" onClick={() => navigateFromMenu('/')}>学习主页</button>
              )}
              {hasAnySpaceAdminRole && (
                <button className="user-menu-item" onClick={() => navigateFromMenu('/manage/space')}>空间管理</button>
              )}
              {isSystemAdmin && (
                <button className="user-menu-item" onClick={() => navigateFromMenu('/manage/root-problems')}>根题库管理</button>
              )}
              {isSystemAdmin && (
                <button className="user-menu-item" onClick={() => navigateFromMenu('/manage/system')}>系统管理</button>
              )}
              <button
                className="user-menu-item"
                onClick={() => {
                  setUserMenuOpen(false)
                  setChangePasswordOpen(true)
                  setChangePasswordMessage('')
                }}
              >
                修改密码
              </button>
              <button
                className="user-menu-item danger"
                onClick={() => {
                  setUserMenuOpen(false)
                  onLogout()
                }}
              >
                退出登录
              </button>
            </div>
          )}
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}
      {changePasswordOpen && renderChangePasswordSection()}
      {renderCurrentView()}
      {renderConfigModal()}
    </div>
  )
}

