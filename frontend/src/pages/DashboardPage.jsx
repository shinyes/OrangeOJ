import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, toFriendlyError } from '../api'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import { ChevronDown } from 'lucide-react'
import ChangePasswordPanel from '../components/dashboard/ChangePasswordPanel'
import ConfirmDialog from '../components/dashboard/ConfirmDialog'
import DashboardDialogs from '../components/dashboard/DashboardDialogs'
import DashboardSpaceSwitcher from '../components/dashboard/DashboardSpaceSwitcher'
import LearningPanel from '../components/dashboard/LearningPanel'
import SpaceManagePanel from '../components/dashboard/SpaceManagePanel'
import SystemPanel from '../components/dashboard/SystemPanel'
import ToastMessage from '../components/ToastMessage'
import useDashboardActions from '../hooks/useDashboardActions'
import useDashboardData from '../hooks/useDashboardData'
import useChangePasswordState from '../hooks/useChangePasswordState'
import useConfirmDialog from '../hooks/useConfirmDialog'
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
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [trainingActionMessage, setTrainingActionMessage] = useState('')
  const [homeworkActionMessage, setHomeworkActionMessage] = useState('')
  const searchState = useDashboardSearchState()
  const memberState = useDashboardMemberState()
  const passwordState = useChangePasswordState()
  const confirmDialog = useConfirmDialog()
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
    user,
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
    if (!new URLSearchParams(location.search).get('mtab')) {
      setSpaceManageTab('settings')
    }
  }, [selectedSpaceId, canManageSelectedSpace, selectedSpace, memberState.resetMemberState, searchState.resetSearchState, setMemberCandidates, setSpaceManageTab])

  useEffect(() => {
    if (isSystemManageView && !new URLSearchParams(location.search).get('stab')) {
      setSystemTab('settings')
    }
  }, [isSystemManageView])

  useEffect(() => {
    const key = `scroll-${location.pathname}${location.search}`
    const saved = sessionStorage.getItem(key)
    if (saved) {
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(saved, 10))
        sessionStorage.removeItem(key)
      })
    }
    return () => {
      sessionStorage.setItem(key, String(window.scrollY))
    }
  }, [location.pathname, location.search])

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
    },
    confirmAction: confirmDialog.confirm
  })

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key !== 'Escape') return
      setUserMenuOpen(false)
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
      onExportTrainingPlan={(planId) => api.exportTrainingPlan(selectedSpaceId, planId)}
      onDeleteTrainingPlan={deleteTrainingPlan}
      onJoinTrainingPlan={joinTrainingPlan}
      trainingActionMessage={trainingActionMessage}
      learningHomeworkSearch={searchState.learningHomeworkSearch}
      onLearningHomeworkSearchChange={searchState.setLearningHomeworkSearch}
      onOpenCreateHomework={openCreateHomeworkModal}
      filteredLearningHomeworks={filteredLearningHomeworks}
      onOpenEditHomework={openEditHomework}
      onOpenAssignHomeworkTarget={openAssignHomeworkTargetModal}
      onExportHomework={(homeworkId) => api.exportHomework(selectedSpaceId, homeworkId)}
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
      onSpaceManageTabChange={(v) => { setSpaceManageTab(v); navigate({ search: `?mtab=${v}` }, { replace: true }) }}
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
      onExportSpaceProblem={(problemId) => api.exportProblems(selectedSpaceId, [problemId])}
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
      onSystemTabChange={(v) => { setSystemTab(v); navigate({ search: `?stab=${v}` }, { replace: true }) }}
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
          <Card><CardContent className="p-6">
            <h2 className="text-base font-bold">系统管理</h2>
            <p className="text-muted-foreground">当前账号无系统管理员权限。</p>
          </CardContent>
        </Card>
        )
      }
      return renderSystemSection()
    }

    return (
      <Card><CardContent className="p-6">
        <p className="text-muted-foreground">未知页面。</p>
      </CardContent>
    </Card>
    )
  }

  const pageTitle = isLearnView
    ? '学习主页'
    : isSpaceManageView
      ? '空间管理'
      : '系统管理'

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background shadow-sm">
        <div className="max-w-screen-xl mx-auto px-2 md:px-4">
          <div className="flex items-center justify-between min-h-10 md:min-h-14 py-1 gap-2 flex-wrap">
            {/* Left section */}
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-1 cursor-pointer hover:opacity-90"
                onClick={() => navigate('/')}
              >
                <span className="text-lg font-bold text-primary">🍊 OrangeOJ</span>
              </div>

              {isLearnView && (
                <div className="flex items-center gap-2">
                  <DashboardSpaceSwitcher
                    spaces={spaces}
                    selectedSpaceId={selectedSpaceId}
                    onSpaceChange={setSelectedSpaceId}
                    isSystemAdmin={isSystemAdmin}
                    hasAnySpaceAdminRole={hasAnySpaceAdminRole}
                    showManageButton={false}
                    onManage={() => navigate('/manage/space')}
                    onCreateSpace={() => openConfigModal('create-space')}
                  />
                  <Tabs value={spaceTab} onValueChange={(v) => { setSpaceTab(v); navigate({ search: `?tab=${v}` }, { replace: true }) }}>
                    <TabsList className="h-9">
                      <TabsTrigger value="problems" className="text-xs px-3">题库</TabsTrigger>
                      <TabsTrigger value="homework" className="text-xs px-3">作业</TabsTrigger>
                      <TabsTrigger value="training" className="text-xs px-3">训练</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              )}

              {isSpaceManageView && (
                <div className="flex items-center gap-2 ml-3">
                  <span className="text-base font-semibold">{pageTitle}</span>
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
                </div>
              )}

              {!isLearnView && !isSpaceManageView && (
                <span className="text-base font-semibold ml-3">{pageTitle}</span>
              )}
            </div>

            {/* Right section: User menu */}
            <div>
              <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost">
                    {user.username}
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {location.pathname !== '/' && (
                    <DropdownMenuItem onClick={() => { navigate('/'); setUserMenuOpen(false); }}>
                      学习主页
                    </DropdownMenuItem>
                  )}
                  {hasAnySpaceAdminRole && (
                    <DropdownMenuItem onClick={() => { navigate('/manage/space'); setUserMenuOpen(false); }}>
                      空间管理
                    </DropdownMenuItem>
                  )}
                  {isSystemAdmin && (
                    <DropdownMenuItem onClick={() => { navigate('/manage/system'); setUserMenuOpen(false); }}>
                      系统管理
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    setUserMenuOpen(false);
                    passwordState.openChangePassword();
                  }}>
                    修改密码
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setUserMenuOpen(false);
                    onLogout();
                  }}>
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4 mt-4 mb-6">
        {error && <ToastMessage message={error} severity="error" onShown={() => setError('')} />}
        <ChangePasswordPanel
          open={passwordState.changePasswordOpen}
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
        <ConfirmDialog {...confirmDialog.dialogProps} />
      </div>
    </div>
  )
}
