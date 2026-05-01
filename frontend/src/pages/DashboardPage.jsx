import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toFriendlyError } from '../api'
import Box from '@mui/material/Box'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Container from '@mui/material/Container'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import ChangePasswordPanel from '../components/dashboard/ChangePasswordPanel'
import DashboardDialogs from '../components/dashboard/DashboardDialogs'
import DashboardSpaceSwitcher from '../components/dashboard/DashboardSpaceSwitcher'
import LearningPanel from '../components/dashboard/LearningPanel'
import SpaceManagePanel from '../components/dashboard/SpaceManagePanel'
import SystemPanel from '../components/dashboard/SystemPanel'
import ToastMessage from '../components/ToastMessage'
import useDashboardActions from '../hooks/useDashboardActions'
import useDashboardData from '../hooks/useDashboardData'
import useChangePasswordState from '../hooks/useChangePasswordState'
import useDashboardModalState from '../hooks/useDashboardModalState'
import useDashboardMemberState from '../hooks/useDashboardMemberState'
import useDashboardSearchState from '../hooks/useDashboardSearchState'

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

export default function DashboardPage({ user, onLogout, view = 'learn' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isSystemAdmin = user.globalRole === 'system_admin'
  const isLearnView = view === 'learn'
  const isSpaceManageView = view === 'space-manage'
  const isSystemManageView = view === 'system-manage'
  const [error, setError] = useState('')
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null)
  const userMenuOpen = Boolean(userMenuAnchorEl)
  const [trainingActionMessage, setTrainingActionMessage] = useState('')
  const [homeworkActionMessage, setHomeworkActionMessage] = useState('')
  const searchState = useDashboardSearchState()
  const memberState = useDashboardMemberState()
  const passwordState = useChangePasswordState()
  const {
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
    refreshSpaceMemberData
  } = useDashboardData({
    isSystemAdmin,
    isLearnView,
    isSpaceManageView,
    locationSearch: location.search,
    setError,
    spaceProblemSearch: searchState.spaceProblemSearch,
    learningProblemSearch: searchState.learningProblemSearch,
    learningTrainingSearch: searchState.learningTrainingSearch,
    learningHomeworkSearch: searchState.learningHomeworkSearch,
    memberCandidateInput: memberState.memberCandidateInput
  })
  const modalState = useDashboardModalState({
    selectedSpace,
    selectedSpaceId,
    canManageSelectedSpace,
    normalizeLanguage
  })
  const openConfigModal = (modalType) => {
    setError('')
    modalState.openConfigModal(modalType)
  }
  const closeConfigModal = () => {
    modalState.closeConfigModal()
  }

  useEffect(() => {
    memberState.resetMemberState()
    setMemberCandidates([])
    setTrainingActionMessage('')
    setHomeworkActionMessage('')
    searchState.resetSearchState()
    setSpaceManageTab('settings')
  }, [selectedSpaceId, canManageSelectedSpace, selectedSpace, memberState.resetMemberState, searchState.resetSearchState, setMemberCandidates, setSpaceManageTab])

  useEffect(() => {
    if (isSystemManageView) {
      setSystemTab('settings')
    }
  }, [isSystemManageView])

  const {
    createSpace,
    updateSpaceSettings,
    createSpaceProblem,
    removeSpaceProblem,
    openEditProblem,
    saveEditedSpaceProblem,
    openCreateTrainingPlanModal,
    openAssignTrainingParticipantModal,
    createTrainingPlan,
    openEditTrainingPlan,
    saveEditedTrainingPlan,
    deleteTrainingPlan,
    joinTrainingPlan,
    handleAddTrainingParticipant,
    openCreateHomeworkModal,
    createHomework,
    openEditHomework,
    saveEditedHomework,
    deleteHomework,
    openAssignHomeworkTargetModal,
    handleAddHomeworkTarget,
    handleAddMembers,
    handleResetSpaceMemberPassword,
    handleRemoveSpaceMember,
    toggleRegistration,
    handleAdminResetPassword,
    handleChangePassword,
    handleBatchRegister,
    copyBatchResult
  } = useDashboardActions({
    selectedSpaceId,
    canManageSelectedSpace,
    registrationEnabled,
    refreshSpaces,
    refreshSpaceData,
    refreshSpaceMemberData,
    setRegistrationEnabled,
    setError,
    normalizeLanguage,
    problemState: {
      spaceProblems,
      editingProblemId: modalState.editingProblemId,
      setEditingProblemId: modalState.setEditingProblemId,
      editingSpaceProblem: modalState.editingSpaceProblem,
      setEditingSpaceProblem: modalState.setEditingSpaceProblem
    },
    trainingState: {
      trainingPlans,
      setTrainingActionMessage,
      editingTrainingPlan: modalState.editingTrainingPlan,
      setEditingTrainingPlan: modalState.setEditingTrainingPlan,
      assigningTrainingPlan: modalState.assigningTrainingPlan,
      setAssigningTrainingPlan: modalState.setAssigningTrainingPlan,
      trainingParticipantUserId: modalState.trainingParticipantUserId,
      setTrainingParticipantUserId: modalState.setTrainingParticipantUserId,
      setTrainingParticipantSubmitting: modalState.setTrainingParticipantSubmitting
    },
    homeworkState: {
      homeworks,
      setHomeworkActionMessage,
      editingHomework: modalState.editingHomework,
      setEditingHomework: modalState.setEditingHomework,
      assigningHomework: modalState.assigningHomework,
      setAssigningHomework: modalState.setAssigningHomework,
      homeworkTargetUserId: modalState.homeworkTargetUserId,
      setHomeworkTargetUserId: modalState.setHomeworkTargetUserId,
      setHomeworkTargetSubmitting: modalState.setHomeworkTargetSubmitting
    },
    memberState: {
      ...memberState,
      setMemberCandidates,
    },
    systemState: {
      newSpaceName: modalState.newSpaceName,
      setNewSpaceName: modalState.setNewSpaceName,
      newSpaceDesc: modalState.newSpaceDesc,
      setNewSpaceDesc: modalState.setNewSpaceDesc,
      spaceSettingsName: modalState.spaceSettingsName,
      spaceSettingsDescription: modalState.spaceSettingsDescription,
      spaceDefaultLanguage: modalState.spaceDefaultLanguage,
      setSpaceSettingsSubmitting: modalState.setSpaceSettingsSubmitting,
      setSpaceSettingsMessage: modalState.setSpaceSettingsMessage,
      adminResetUserId: modalState.adminResetUserId,
      setAdminResetUserId: modalState.setAdminResetUserId,
      setAdminResetSubmitting: modalState.setAdminResetSubmitting,
      setAdminResetMessage: modalState.setAdminResetMessage
    },
    passwordState: {
      ...passwordState
    },
    batchState: {
      batchInput: modalState.batchInput,
      batchSpaceId: modalState.batchSpaceId,
      batchResult: modalState.batchResult,
      setBatchResult: modalState.setBatchResult,
      setBatchSubmitting: modalState.setBatchSubmitting
    },
    modalState: {
      openConfigModal,
      closeConfigModal
    }
  })

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key !== 'Escape') return
      setUserMenuAnchorEl(null)
      if (passwordState.changePasswordOpen) {
        passwordState.closeChangePassword()
      }
      if (modalState.activeConfigModal) {
        closeConfigModal()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [modalState.activeConfigModal, passwordState.changePasswordOpen, passwordState.closeChangePassword])

  const renderLearningSection = () => (
    <LearningPanel
      selectedSpace={selectedSpace}
      spaces={spaces}
      spaceTab={spaceTab}
      learningProblemSearch={searchState.learningProblemSearch}
      onLearningProblemSearchChange={searchState.setLearningProblemSearch}
      filteredLearningProblems={filteredLearningProblems}
      problemTypeText={problemTypeText}
      learningTrainingSearch={searchState.learningTrainingSearch}
      onLearningTrainingSearchChange={searchState.setLearningTrainingSearch}
      canManageSelectedSpace={canManageSelectedSpace}
      onOpenCreateTrainingPlan={openCreateTrainingPlanModal}
      filteredLearningTrainingPlans={filteredLearningTrainingPlans}
      onOpenEditTrainingPlan={openEditTrainingPlan}
      onOpenAssignTrainingParticipant={openAssignTrainingParticipantModal}
      onDeleteTrainingPlan={deleteTrainingPlan}
      onJoinTrainingPlan={joinTrainingPlan}
      trainingActionMessage={trainingActionMessage}
      learningHomeworkSearch={searchState.learningHomeworkSearch}
      onLearningHomeworkSearchChange={searchState.setLearningHomeworkSearch}
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
      canManageSelectedSpace={canManageSelectedSpace}
      spaceManageTab={spaceManageTab}
      onSpaceManageTabChange={setSpaceManageTab}
      normalizeLanguage={normalizeLanguage}
      openSpaceSettingsModal={() => openConfigModal('space-settings')}
      spaceSettingsMessage={modalState.spaceSettingsMessage}
      spaceProblemSearch={searchState.spaceProblemSearch}
      onSpaceProblemSearchChange={searchState.setSpaceProblemSearch}
      filteredSpaceProblems={filteredSpaceProblems}
      spaceProblems={spaceProblems}
      problemTypeText={problemTypeText}
      editingProblemId={modalState.editingProblemId}
      onOpenEditProblem={openEditProblem}
      onRemoveSpaceProblem={removeSpaceProblem}
      spaceMembers={spaceMembers}
      memberRole={memberState.memberRole}
      onMemberRoleChange={memberState.setMemberRole}
      memberCandidateInput={memberState.memberCandidateInput}
      onMemberCandidateInputChange={memberState.setMemberCandidateInput}
      memberCandidates={memberCandidates}
      selectedMemberCandidates={memberState.selectedMemberCandidates}
      onSelectedMemberCandidatesChange={memberState.setSelectedMemberCandidates}
      memberSearchLoading={memberSearchLoading}
      onSubmitMembers={handleAddMembers}
      memberSubmitting={memberState.memberSubmitting}
      onResetMemberPassword={handleResetSpaceMemberPassword}
      resettingMemberId={memberState.resettingMemberId}
      onRemoveMember={handleRemoveSpaceMember}
      removingMemberId={memberState.removingMemberId}
      memberMessage={memberState.memberMessage}
      openUploadProblemModal={() => openConfigModal('upload-space-problem')}
      selectedSpaceId={selectedSpaceId}
    />
  )

  const renderSystemSection = () => (
    <SystemPanel
      systemTab={systemTab}
      onSystemTabChange={setSystemTab}
      registrationEnabled={registrationEnabled}
      onToggleRegistration={toggleRegistration}
      onOpenAdminResetDialog={() => openConfigModal('admin-reset-password')}
      adminResetMessage={modalState.adminResetMessage}
      onOpenBatchRegisterDialog={() => openConfigModal('batch-register')}
      batchResult={modalState.batchResult}
      onCopyBatchResult={copyBatchResult}
      toFriendlyError={toFriendlyError}
    />
  )

  const renderCurrentView = () => {
    if (isLearnView) return renderLearningSection()
    if (isSpaceManageView) return renderSpaceManageSection()

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
                  <DashboardSpaceSwitcher
                    spaces={spaces}
                    selectedSpaceId={selectedSpaceId}
                    onSpaceChange={setSelectedSpaceId}
                    isSystemAdmin={isSystemAdmin}
                    hasAnySpaceAdminRole={hasAnySpaceAdminRole}
                    onManage={() => navigate('/manage/space')}
                    onCreateSpace={() => openConfigModal('create-space')}
                  />
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

              {isSpaceManageView && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 2 }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                    {pageTitle}
                  </Typography>
                  <DashboardSpaceSwitcher
                    spaces={spaces}
                    selectedSpaceId={selectedSpaceId}
                    onSpaceChange={setSelectedSpaceId}
                    isSystemAdmin={isSystemAdmin}
                    hasAnySpaceAdminRole={hasAnySpaceAdminRole}
                    mode="manage"
                    showManageButton={false}
                    showCreateButton
                    onManage={() => navigate('/manage/space')}
                    onCreateSpace={() => openConfigModal('create-space')}
                  />
                </Box>
              )}
              
              {!isLearnView && !isSpaceManageView && (
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
                  <MenuItem onClick={() => { navigate('/manage/system'); setUserMenuAnchorEl(null); }}>
                    系统管理
                  </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={() => {
                  setUserMenuAnchorEl(null);
                  passwordState.openChangePassword();
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
        {passwordState.changePasswordOpen && (
          <ChangePasswordPanel
            oldPassword={passwordState.oldPassword}
            newPassword={passwordState.newPassword}
            confirmPassword={passwordState.confirmPassword}
            onOldPasswordChange={passwordState.setOldPassword}
            onNewPasswordChange={passwordState.setNewPassword}
            onConfirmPasswordChange={passwordState.setConfirmPassword}
            submitting={passwordState.changePasswordSubmitting}
            onSubmit={handleChangePassword}
            onCancel={passwordState.closeChangePassword}
            message={passwordState.changePasswordMessage}
            onMessageShown={() => passwordState.setChangePasswordMessage('')}
          />
        )}
        {renderCurrentView()}
        <DashboardDialogs
          modalState={modalState}
          onClose={closeConfigModal}
          spaceProblems={spaceProblems}
          spaces={spaces}
          onCreateSpace={createSpace}
          onUpdateSpaceSettings={updateSpaceSettings}
          onCreateSpaceProblem={createSpaceProblem}
          onSaveEditedSpaceProblem={saveEditedSpaceProblem}
          onCreateTrainingPlan={createTrainingPlan}
          onSaveEditedTrainingPlan={saveEditedTrainingPlan}
          onAddTrainingParticipant={handleAddTrainingParticipant}
          onCreateHomework={createHomework}
          onSaveEditedHomework={saveEditedHomework}
          onAddHomeworkTarget={handleAddHomeworkTarget}
          onAdminResetPassword={handleAdminResetPassword}
          onBatchRegister={handleBatchRegister}
          selectedSpaceId={selectedSpaceId}
        />
      </Container>
    </Box>
  )
}


