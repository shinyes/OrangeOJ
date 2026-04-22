import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { api, toFriendlyError } from '../api'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import Container from '@mui/material/Container'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Paper from '@mui/material/Paper'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Tooltip from '@mui/material/Tooltip'
import Grid from '@mui/material/Grid'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import RootProblemCreator from '../components/dashboard/RootProblemCreator'
import TrainingPlanEditor from '../components/dashboard/TrainingPlanEditor'
import HomeworkEditor from '../components/dashboard/HomeworkEditor'
import RootProblemTable from '../components/dashboard/RootProblemTable'
import LearningPanel from '../components/dashboard/LearningPanel'
import SpaceManagePanel from '../components/dashboard/SpaceManagePanel'
import SystemPanel from '../components/dashboard/SystemPanel'
import ToastMessage from '../components/ToastMessage'

function problemTypeText(type) {
  if (type === 'programming') return '编程题'
  if (type === 'single_choice') return '单选题'
  if (type === 'true_false') return '判断题'
  return type
}

function homeworkDisplayModeText(mode) {
  return mode === 'list' ? '题单模式' : '试卷模式'
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
      const normalized = line.replace(/,/g, ',')
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
      return `第 ${row.index} 行\t${username}\t成功\t用户 ID: ${row.userId}`
    }
    return `第 ${row.index} 行\t${username}\t失败\t原因: ${toFriendlyError(row.reason || '未知错误')}`
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
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null)
  const userMenuOpen = Boolean(userMenuAnchorEl)
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
  const [trainingActionMessage, setTrainingActionMessage] = useState('')
  const [homeworks, setHomeworks] = useState([])
  const [homeworkActionMessage, setHomeworkActionMessage] = useState('')

  const [newSpaceName, setNewSpaceName] = useState('')
  const [newSpaceDesc, setNewSpaceDesc] = useState('')
  const [spaceSettingsName, setSpaceSettingsName] = useState('')
  const [spaceSettingsDescription, setSpaceSettingsDescription] = useState('')
  const [spaceDefaultLanguage, setSpaceDefaultLanguage] = useState('cpp')
  const [spaceSettingsSubmitting, setSpaceSettingsSubmitting] = useState(false)
  const [spaceSettingsMessage, setSpaceSettingsMessage] = useState('')

  const [spaceProblemSearch, setSpaceProblemSearch] = useState('')
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
  const [learningProblemSearch, setLearningProblemSearch] = useState('')
  const [learningTrainingSearch, setLearningTrainingSearch] = useState('')
  const [learningHomeworkSearch, setLearningHomeworkSearch] = useState('')
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
  const requestedSpaceId = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('spaceId')
    const parsed = Number(raw)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }, [location.search])
  const requestedSpaceTab = useMemo(() => {
    const raw = new URLSearchParams(location.search).get('tab')
    return ['problems', 'training', 'homework'].includes(raw) ? raw : ''
  }, [location.search])

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
      setTrainingActionMessage('')
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
    if (!isLearnView || !requestedSpaceId) return
    if (spaces.some((space) => space.id === requestedSpaceId)) {
      setSelectedSpaceId(requestedSpaceId)
    }
  }, [isLearnView, requestedSpaceId, spaces])

  useEffect(() => {
    if (!isLearnView || !requestedSpaceTab) return
    setSpaceTab(requestedSpaceTab)
  }, [isLearnView, requestedSpaceTab])

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
    setTrainingActionMessage('')
    setEditingTrainingPlan(null)
    setAssigningTrainingPlan(null)
    setTrainingParticipantUserId('')
    setTrainingParticipantSubmitting(false)
    setEditingHomework(null)
    setAssigningHomework(null)
    setHomeworkTargetUserId('')
    setHomeworkTargetSubmitting(false)
    setHomeworkActionMessage('')
    setSpaceSettingsName(selectedSpace?.name || '')
    setSpaceSettingsDescription(selectedSpace?.description || '')
    setSpaceDefaultLanguage(normalizeLanguage(selectedSpace?.defaultProgrammingLanguage || 'cpp'))
    setSpaceSettingsMessage('')
    setSpaceProblemSearch('')
    setEditingProblemId(null)
    setEditingSpaceProblem(null)
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
        setUserMenuAnchorEl(null)
      }
    }
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        setUserMenuAnchorEl(null)
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

  const handleCreateRootProblem = async (problemData) => {
    try {
      setError('')
      await api.createRootProblem(problemData)
      await refreshAdminData()
      if (canManageSelectedSpace && selectedSpaceId) {
        await refreshSpaceRootProblemData(selectedSpaceId)
      }
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const handleUpdateRootProblem = async (problemId, problemData) => {
    try {
      setError('')
      await api.updateRootProblem(problemId, problemData)
      await refreshAdminData()
      if (selectedSpaceId) {
        await refreshSpaceData(selectedSpaceId)
        if (canManageSelectedSpace) {
          await refreshSpaceRootProblemData(selectedSpaceId)
        }
      }
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const handleDeleteRootProblem = async (problemId) => {
    try {
      setError('')
      await api.deleteRootProblem(problemId)
      await refreshAdminData()
      if (selectedSpaceId) {
        await refreshSpaceData(selectedSpaceId)
        if (canManageSelectedSpace) {
          await refreshSpaceRootProblemData(selectedSpaceId)
        }
      }
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const createSpaceProblem = async (problemData) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      await api.createSpaceProblem(selectedSpaceId, problemData)
      await refreshSpaceData(selectedSpaceId)
      await refreshSpaceRootProblemData(selectedSpaceId)
      if (isSystemAdmin) {
        await refreshAdminData()
      }
    } catch (err) {
      setError(err.message)
      throw err
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
        setEditingSpaceProblem(null)
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
    setEditingSpaceProblem(problem)
    openConfigModal('edit-space-problem')
  }

  const saveEditedSpaceProblem = async (problemData) => {
    if (!selectedSpaceId || !editingSpaceProblem?.id) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      await api.updateSpaceProblem(selectedSpaceId, editingSpaceProblem.id, problemData)
      await refreshSpaceData(selectedSpaceId)
      await refreshSpaceRootProblemData(selectedSpaceId)
      if (isSystemAdmin) {
        await refreshAdminData()
      }
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const openCreateTrainingPlanModal = () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    setEditingTrainingPlan(null)
    openConfigModal('create-training-plan')
  }

  const openAssignTrainingParticipantModal = (planId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const plan = trainingPlans.find((item) => item.id === planId)
    if (!plan) {
      setError('训练计划不存在')
      return
    }
    setAssigningTrainingPlan(plan)
    setTrainingParticipantUserId('')
    openConfigModal('assign-training-participant')
  }

  const createTrainingPlan = async (planData) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      setTrainingActionMessage('')
      await api.createTrainingPlan(selectedSpaceId, planData)
      await refreshSpaceData(selectedSpaceId)
      setTrainingActionMessage('训练计划创建成功')
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
      setEditingTrainingPlan(detail)
      openConfigModal('edit-training-plan')
    } catch (err) {
      setError(err.message || '加载训练详情失败')
    }
  }

  const saveEditedTrainingPlan = async (planData) => {
    if (!selectedSpaceId || !editingTrainingPlan?.id) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      setTrainingActionMessage('')
      await api.updateTrainingPlan(selectedSpaceId, editingTrainingPlan.id, planData)
      await refreshSpaceData(selectedSpaceId)
      setTrainingActionMessage('训练计划保存成功')
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
      setTrainingActionMessage('')
      await api.deleteTrainingPlan(selectedSpaceId, planId)
      if (editingTrainingPlan?.id === planId) {
        setEditingTrainingPlan(null)
      }
      await refreshSpaceData(selectedSpaceId)
      setTrainingActionMessage('训练计划删除成功')
    } catch (err) {
      setError(err.message)
    }
  }

  const joinTrainingPlan = async (planId) => {
    if (!selectedSpaceId) return
    try {
      setError('')
      setTrainingActionMessage('')
      await api.joinTrainingPlan(selectedSpaceId, planId)
      await refreshSpaceData(selectedSpaceId)
      setTrainingActionMessage('已加入训练计划')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddTrainingParticipant = async () => {
    if (!selectedSpaceId || !assigningTrainingPlan?.id) return
    if (!ensureCanManageSpace()) return

    const userId = Number(trainingParticipantUserId.trim())
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户 ID')
      return
    }

    try {
      setError('')
      setTrainingActionMessage('')
      setTrainingParticipantSubmitting(true)
      await api.addTrainingPlanParticipant(selectedSpaceId, assigningTrainingPlan.id, userId)
      setTrainingParticipantUserId('')
      await refreshSpaceData(selectedSpaceId)
      setTrainingActionMessage(`已将用户 #${userId} 添加到训练 #${assigningTrainingPlan.id}`)
      closeConfigModal()
    } catch (err) {
      setError(err.message || '分配训练成员失败')
    } finally {
      setTrainingParticipantSubmitting(false)
    }
  }

  const openCreateHomeworkModal = () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    setEditingHomework(null)
    openConfigModal('create-homework')
  }

  const createHomework = async (homeworkData) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      setHomeworkActionMessage('')
      await api.createHomework(selectedSpaceId, homeworkData)
      await refreshSpaceData(selectedSpaceId)
      setHomeworkActionMessage('作业创建成功')
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
      setEditingHomework(detail)
      openConfigModal('edit-homework')
    } catch (err) {
      setError(err.message || '加载作业详情失败')
    }
  }

  const saveEditedHomework = async (homeworkData) => {
    if (!selectedSpaceId || !editingHomework?.id) return
    if (!ensureCanManageSpace()) return
    try {
      setError('')
      setHomeworkActionMessage('')
      await api.updateHomework(selectedSpaceId, editingHomework.id, homeworkData)
      const savedHomework = await api.getHomework(selectedSpaceId, editingHomework.id)
      const expectedMode = homeworkData.displayMode === 'list' ? 'list' : 'exam'
      const actualMode = savedHomework?.displayMode === 'list' ? 'list' : 'exam'
      if (actualMode !== expectedMode) {
        throw new Error(`作业基础信息已保存，但页面模式未生效。期望：${homeworkDisplayModeText(expectedMode)}，实际：${homeworkDisplayModeText(actualMode)}。请重启后端后重试。`)
      }
      await refreshSpaceData(selectedSpaceId)
      setEditingHomework(savedHomework)
      setHomeworkActionMessage('作业保存成功')
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
      setHomeworkActionMessage('')
      await api.deleteHomework(selectedSpaceId, homeworkId)
      if (editingHomework?.id === homeworkId) {
        setEditingHomework(null)
      }
      await refreshSpaceData(selectedSpaceId)
      setHomeworkActionMessage('作业删除成功')
    } catch (err) {
      setError(err.message || '删除作业失败')
    }
  }

  const openAssignHomeworkTargetModal = (homeworkId) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const homework = homeworks.find((item) => item.id === homeworkId)
    if (!homework) {
      setError('作业不存在')
      return
    }
    setAssigningHomework(homework)
    setHomeworkTargetUserId('')
    openConfigModal('assign-homework-target')
  }

  const handleAddHomeworkTarget = async () => {
    if (!selectedSpaceId || !assigningHomework?.id) return
    if (!ensureCanManageSpace()) return
    const userId = Number(homeworkTargetUserId.trim())
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户 ID')
      return
    }

    try {
      setError('')
      setHomeworkActionMessage('')
      setHomeworkTargetSubmitting(true)
      await api.addHomeworkTarget(selectedSpaceId, assigningHomework.id, userId)
      setHomeworkTargetUserId('')
      await refreshSpaceData(selectedSpaceId)
      setHomeworkActionMessage(`已将用户 #${userId} 添加到作业 #${assigningHomework.id}`)
      closeConfigModal()
    } catch (err) {
      setError(err.message || '分配作业用户失败')
    } finally {
      setHomeworkTargetSubmitting(false)
    }
  }

  const handleAddMember = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    const userId = Number(memberUserId)
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户 ID')
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
      setMemberResetMessage(`鐢ㄦ埛 #${userId}瀵嗙爜宸查噸缃负 123456`)
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
      setAdminResetMessage(`鐢ㄦ埛 #${userId}瀵嗙爜宸查噸缃负123456`)
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
      setError('请输入批量账号，格式为每行：用户名，密码')
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

  const navigateFromMenu = (path) => {
    setUserMenuAnchorEl(null)
    navigate(path)
  }

  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false)

  const renderTopbarSpaceSwitcher = () => {
    const currentSpace = spaces.find(s => s.id === selectedSpaceId)
    const isAdmin = user?.role === 'admin'
    const isSpaceAdmin = currentSpace?.myRole === 'admin'
    const canManage = isAdmin || isSpaceAdmin
    const mySpaces = isAdmin ? spaces : spaces.filter(s => s.myRole)

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {canManage && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate('/manage/space')}
            sx={{ minWidth: 'auto' }}
          >
            管理
          </Button>
        )}
        <FormControl size="small" sx={{ minWidth: 120, bgcolor: 'background.paper' }}>
          <InputLabel id="space-select-label">空间</InputLabel>
          <Select
            labelId="space-select-label"
            value={selectedSpaceId || ''}
            label="空间"
            onChange={(e) => setSelectedSpaceId(Number(e.target.value))}
          >
            {mySpaces.map((space) => (
              <MenuItem key={space.id} value={space.id}>
                {space.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
    )
  }

  const renderChangePasswordSection = () => (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        修改密码
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          type="password"
          placeholder="旧密码"
          value={oldPassword}
          onChange={(event) => setOldPassword(event.target.value)}
          size="small"
        />
        <TextField
          type="password"
          placeholder="新密码（至少6 位）"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          size="small"
        />
        <TextField
          type="password"
          placeholder="确认新密码"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          size="small"
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            variant="contained" 
            disabled={changePasswordSubmitting} 
            onClick={handleChangePassword}
          >
            {changePasswordSubmitting ? '提交中...' : '确认修改密码'}
          </Button>
          <Button 
            variant="outlined"
            onClick={() => setChangePasswordOpen(false)}
          >
            取消
          </Button>
        </Box>
        {changePasswordMessage && (
          <ToastMessage message={changePasswordMessage} severity="success" onShown={() => setChangePasswordMessage('')} />
        )}
      </Box>
    </Paper>
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
      return (
        <RootProblemCreator
          open
          mode="create"
          createTitle="上传题目（自动加入根题库并关联到当前空间）"
          createSubmitText="上传并关联"
          onClose={closeConfigModal}
          onSubmit={createSpaceProblem}
        />
      )
    }

    if (activeConfigModal === 'edit-space-problem') {
      if (!editingSpaceProblem) return null
      return (
        <RootProblemCreator
          open
          mode="edit"
          problem={editingSpaceProblem}
          editTitle={editingProblemId ? `编辑题目 #${editingProblemId}` : '编辑题目'}
          editSubmitText="保存修改"
          onClose={closeConfigModal}
          onSubmit={saveEditedSpaceProblem}
        />
      )
    }

    if (activeConfigModal === 'create-training-plan') {
      return (
        <TrainingPlanEditor
          open
          mode="create"
          problemOptions={spaceProblems}
          onClose={closeConfigModal}
          onSubmit={createTrainingPlan}
        />
      )
    }

    if (activeConfigModal === 'edit-training-plan') {
      if (!editingTrainingPlan) return null
      return (
        <TrainingPlanEditor
          open
          mode="edit"
          plan={editingTrainingPlan}
          problemOptions={spaceProblems}
          onClose={closeConfigModal}
          onSubmit={saveEditedTrainingPlan}
        />
      )
    }

    if (activeConfigModal === 'assign-training-participant') {
      title = assigningTrainingPlan ? `分配训练成员：${assigningTrainingPlan.title}` : '分配训练成员'
      content = (
        <div className="config-form">
          <input
            type="number"
            min="1"
            placeholder="用户 ID"
            value={trainingParticipantUserId}
            onChange={(event) => setTrainingParticipantUserId(event.target.value)}
          />
          <div className="inline-form">
            <button disabled={trainingParticipantSubmitting} onClick={handleAddTrainingParticipant}>
              {trainingParticipantSubmitting ? '分配中...' : '确认分配'}
            </button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    if (activeConfigModal === 'create-homework') {
      return (
        <HomeworkEditor
          open
          mode="create"
          problemOptions={spaceProblems}
          onClose={closeConfigModal}
          onSubmit={createHomework}
        />
      )
    }

    if (activeConfigModal === 'edit-homework') {
      if (!editingHomework) return null
      return (
        <HomeworkEditor
          open
          mode="edit"
          homework={editingHomework}
          problemOptions={spaceProblems}
          onClose={closeConfigModal}
          onSubmit={saveEditedHomework}
        />
      )
    }

    if (activeConfigModal === 'assign-homework-target') {
      title = assigningHomework ? `分配作业成员：${assigningHomework.title}` : '分配作业成员'
      content = (
        <div className="config-form">
          <input
            type="number"
            min="1"
            placeholder="用户 ID"
            value={homeworkTargetUserId}
            onChange={(event) => setHomeworkTargetUserId(event.target.value)}
          />
          <div className="inline-form">
            <button disabled={homeworkTargetSubmitting} onClick={handleAddHomeworkTarget}>
              {homeworkTargetSubmitting ? '分配中...' : '确认分配'}
            </button>
            <button className="ghost-btn btn-link" onClick={closeConfigModal}>取消</button>
          </div>
        </div>
      )
    }

    if (activeConfigModal === 'add-space-member') {
      title = '添加成员 / 空间管理员'
      content = (
        <div className="config-form">
          <input
            type="number"
            min="1"
            placeholder="用户 ID"
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
            placeholder="用户 ID"
            value={memberResetUserId}
            onChange={(event) => setMemberResetUserId(event.target.value)}
          />
          <div className="inline-form">
            <button disabled={memberResetSubmitting} onClick={handleResetSpaceMemberPassword}>
              {memberResetSubmitting ? '重置中...' : '重置为123456'}
            </button>
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
            placeholder="用户 ID"
            value={adminResetUserId}
            onChange={(event) => setAdminResetUserId(event.target.value)}
          />
          <div className="inline-form">
            <button disabled={adminResetSubmitting} onClick={handleAdminResetPassword}>
              {adminResetSubmitting ? '重置中...' : '重置为123456'}
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
    <LearningPanel
      selectedSpace={selectedSpace}
      spaces={spaces}
      spaceTab={spaceTab}
      learningProblemSearch={learningProblemSearch}
      onLearningProblemSearchChange={setLearningProblemSearch}
      filteredLearningProblems={filteredLearningProblems}
      problemTypeText={problemTypeText}
      learningTrainingSearch={learningTrainingSearch}
      onLearningTrainingSearchChange={setLearningTrainingSearch}
      canManageSelectedSpace={canManageSelectedSpace}
      onOpenCreateTrainingPlan={openCreateTrainingPlanModal}
      filteredLearningTrainingPlans={filteredLearningTrainingPlans}
      onOpenEditTrainingPlan={openEditTrainingPlan}
      onOpenAssignTrainingParticipant={openAssignTrainingParticipantModal}
      onDeleteTrainingPlan={deleteTrainingPlan}
      onJoinTrainingPlan={joinTrainingPlan}
      trainingActionMessage={trainingActionMessage}
      learningHomeworkSearch={learningHomeworkSearch}
      onLearningHomeworkSearchChange={setLearningHomeworkSearch}
      onOpenCreateHomework={openCreateHomeworkModal}
      filteredLearningHomeworks={filteredLearningHomeworks}
      onOpenEditHomework={openEditHomework}
      onOpenAssignHomeworkTarget={openAssignHomeworkTargetModal}
      onDeleteHomework={deleteHomework}
      homeworkActionMessage={homeworkActionMessage}
    />
  )

  const renderSpaceManageSection = () => (
    <SpaceManagePanel
      hasAnySpaceAdminRole={hasAnySpaceAdminRole}
      selectedSpace={selectedSpace}
      selectedSpaceId={selectedSpaceId}
      isSystemAdmin={isSystemAdmin}
      canManageSelectedSpace={canManageSelectedSpace}
      spaceSelectorKeyword={spaceSelectorKeyword}
      onSpaceSelectorKeywordChange={setSpaceSelectorKeyword}
      filteredSpacesForManage={filteredSpacesForManage}
      onSelectSpace={setSelectedSpaceId}
      openCreateSpaceModal={() => openConfigModal('create-space')}
      spaceManageTab={spaceManageTab}
      onSpaceManageTabChange={setSpaceManageTab}
      normalizeLanguage={normalizeLanguage}
      openSpaceSettingsModal={() => openConfigModal('space-settings')}
      spaceSettingsName={spaceSettingsName}
      onSpaceSettingsNameChange={setSpaceSettingsName}
      spaceSettingsDescription={spaceSettingsDescription}
      onSpaceSettingsDescriptionChange={setSpaceSettingsDescription}
      spaceDefaultLanguage={spaceDefaultLanguage}
      onSpaceDefaultLanguageChange={setSpaceDefaultLanguage}
      spaceSettingsSubmitting={spaceSettingsSubmitting}
      onUpdateSpaceSettings={updateSpaceSettings}
      closeConfigModal={closeConfigModal}
      spaceSettingsMessage={spaceSettingsMessage}
      spaceProblemSearch={spaceProblemSearch}
      onSpaceProblemSearchChange={setSpaceProblemSearch}
      filteredSpaceRootProblems={filteredSpaceRootProblems}
      linkedProblemIDSet={linkedProblemIDSet}
      onAddProblemToSpace={addProblemToSpace}
      spaceProblems={spaceProblems}
      problemTypeText={problemTypeText}
      editingProblemId={editingProblemId}
      onOpenEditProblem={openEditProblem}
      onRemoveSpaceProblem={removeSpaceProblem}
      openAddMemberModal={() => openConfigModal('add-space-member')}
      openResetMemberPasswordModal={() => openConfigModal('reset-space-member-password')}
      memberMessage={memberMessage}
      memberResetMessage={memberResetMessage}
      openUploadProblemModal={() => openConfigModal('upload-space-problem')}
    />
  )

  const renderRootProblemSection = () => (
    <RootProblemTable
      rootProblems={rootProblems}
      search={rootProblemSearch}
      onSearchChange={setRootProblemSearch}
      onCreate={handleCreateRootProblem}
      onUpdate={handleUpdateRootProblem}
      onDelete={handleDeleteRootProblem}
      problemTypeText={problemTypeText}
    />
  )

  const renderSystemSection = () => (
    <SystemPanel
      systemTab={systemTab}
      onSystemTabChange={setSystemTab}
      registrationEnabled={registrationEnabled}
      onToggleRegistration={toggleRegistration}
      openAdminResetPasswordModal={() => openConfigModal('admin-reset-password')}
      adminResetMessage={adminResetMessage}
      openBatchRegisterModal={() => openConfigModal('batch-register')}
      batchResult={batchResult}
      onCopyBatchResult={copyBatchResult}
      toFriendlyError={toFriendlyError}
    />
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
    <Box sx={{ flexGrow: 1, bgcolor: 'background.default', minHeight: '100vh' }}>
      <AppBar position="static" color="default" elevation={1}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            {/* Left section: Brand + Space Switcher + Tabs */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.9 }
                }}
                onClick={() => navigate('/')}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  OrangeOJ
                </Typography>
              </Box>
              
              {isLearnView && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {renderTopbarSpaceSwitcher()}
                  <Tabs 
                    value={spaceTab} 
                    onChange={(e, newValue) => setSpaceTab(newValue)}
                    size="small"
                    sx={{ minHeight: 36 }}
                  >
                    <Tab label="题库" value="problems" sx={{ minHeight: 36, minWidth: 64 }} />
                    <Tab label="作业" value="homework" sx={{ minHeight: 36, minWidth: 64 }} />
                    <Tab label="训练" value="training" sx={{ minHeight: 36, minWidth: 64 }} />
                  </Tabs>
                </Box>
              )}
              
              {!isLearnView && (
                <Typography variant="h6" sx={{ fontSize: '1rem', ml: 2 }}>
                  {pageTitle}
                </Typography>
              )}
            </Box>
            
            {/* Right section: User menu */}
            <Box>
              <Button
                color="inherit"
                onClick={(e) => setUserMenuAnchorEl(e.currentTarget)}
                startIcon={userMenuOpen ? '^' : 'v'}
              >
                {user.username}
              </Button>
              <Menu
                anchorEl={userMenuAnchorEl}
                open={Boolean(userMenuAnchorEl)}
                onClose={() => setUserMenuAnchorEl(null)}
                PaperProps={{ elevation: 3 }}
              >
                {location.pathname !== '/' && (
                  <MenuItem onClick={() => { navigate('/'); setUserMenuAnchorEl(null); }}>
                    学习主页
                  </MenuItem>
                )}
                {hasAnySpaceAdminRole && (
                  <MenuItem onClick={() => { navigate('/manage/space'); setUserMenuAnchorEl(null); }}>
                    空间管理
                  </MenuItem>
                )}
                {isSystemAdmin && (
                  <>
                    <MenuItem onClick={() => { navigate('/manage/root-problems'); setUserMenuAnchorEl(null); }}>
                      根题库管理
                    </MenuItem>
                    <MenuItem onClick={() => { navigate('/manage/system'); setUserMenuAnchorEl(null); }}>
                      系统管理
                    </MenuItem>
                  </>
                )}
                <Divider />
                <MenuItem onClick={() => {
                  setUserMenuAnchorEl(null);
                  setChangePasswordOpen(true);
                  setChangePasswordMessage('');
                }}>
                  修改密码
                </MenuItem>
                <MenuItem onClick={() => {
                  setUserMenuAnchorEl(null);
                  onLogout();
                }}>
                  退出登录
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      
      <Container maxWidth="xl" sx={{ mt: 2, mb: 3 }}>
        {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}
        {changePasswordOpen && renderChangePasswordSection()}
        {renderCurrentView()}
        {renderConfigModal()}
      </Container>
    </Box>
  )
}

