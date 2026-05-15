import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Badge } from '../ui/badge'
import { Label } from '../ui/label'
import { X } from 'lucide-react'
import HomeworkEditor from './HomeworkEditor'
import ProblemEditor from './ProblemEditor'
import TrainingPlanEditor from './TrainingPlanEditor'
import { api } from '../../api'

function MemberComboBox({ candidates, selectedUsers, inputValue, loading, onInputChange, onSelectionChange }) {
  const getUserLabel = (user) => {
    if (!user) return ''
    const parts = [`#${user.id || user.userId}`, user.username]
    if (user.globalRole === 'system_admin') parts.push('系统管理员')
    if (user.role === 'space_admin') parts.push('空间管理员')
    else if (user.role) parts.push('成员')
    return parts.filter(Boolean).join(' · ')
  }

  const handleSelect = (user) => {
    if (selectedUsers.some((u) => u.id === user.id)) {
      onSelectionChange(selectedUsers.filter((u) => u.id !== user.id))
    } else {
      onSelectionChange([...selectedUsers, user])
    }
  }

  return (
    <div className="space-y-2">
      <Input
        placeholder="搜索用户 ID 或用户名"
        value={inputValue}
        onChange={(e) => onInputChange(e.target.value)}
      />
      {loading && <p className="text-xs text-muted-foreground">搜索中...</p>}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((user) => (
            <Badge key={user.id || user.userId} variant="secondary" className="gap-1 cursor-pointer"
              onClick={() => handleSelect(user)}>
              {getUserLabel(user)}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
      {candidates.length > 0 && (
        <div className="border rounded-lg max-h-48 overflow-y-auto">
          {candidates.map((user) => (
            <div key={user.id || user.userId}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent"
              onClick={() => handleSelect(user)}>
              {getUserLabel(user)}
            </div>
          ))}
        </div>
      )}
      {!loading && !inputValue.trim() && candidates.length === 0 && (
        <p className="text-xs text-muted-foreground">输入用户 ID 或用户名开始搜索</p>
      )}
    </div>
  )
}

export default function DashboardDialogs({
  modalState, onClose, spaceProblems, spaces,
  onCreateSpace, onUpdateSpaceSettings, onCreateSpaceProblem,
  onSaveEditedSpaceProblem, onCreateTrainingPlan, onSaveEditedTrainingPlan,
  onAddTrainingParticipant, onCreateHomework, onSaveEditedHomework,
  onAddHomeworkTarget, onAdminResetPassword, onBatchRegister, selectedSpaceId
}) {
  const activeModal = modalState.activeConfigModal
  const [homeworkTargetInput, setHomeworkTargetInput] = useState('')
  const [homeworkTargetCandidates, setHomeworkTargetCandidates] = useState([])
  const [selectedHomeworkTargetUsers, setSelectedHomeworkTargetUsers] = useState([])
  const [homeworkTargetSearchLoading, setHomeworkTargetSearchLoading] = useState(false)
  const assigningHomeworkId = modalState.assigningHomework?.id || null

  useEffect(() => {
    setHomeworkTargetInput('')
    setHomeworkTargetCandidates([])
    setSelectedHomeworkTargetUsers([])
    setHomeworkTargetSearchLoading(false)
  }, [activeModal, assigningHomeworkId])

  useEffect(() => {
    if (activeModal !== 'assign-homework-target' || !selectedSpaceId || !assigningHomeworkId) {
      setHomeworkTargetCandidates([])
      setHomeworkTargetSearchLoading(false)
      return undefined
    }
    const keyword = homeworkTargetInput.trim()
    if (!keyword) { setHomeworkTargetCandidates([]); setHomeworkTargetSearchLoading(false); return undefined }
    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setHomeworkTargetSearchLoading(true)
        const list = await api.searchHomeworkTargetCandidates(selectedSpaceId, assigningHomeworkId, keyword)
        if (!active) return
        setHomeworkTargetCandidates(list || [])
      } catch { if (!active) return; setHomeworkTargetCandidates([]) }
      finally { if (active) setHomeworkTargetSearchLoading(false) }
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [activeModal, selectedSpaceId, assigningHomeworkId, homeworkTargetInput])

  if (!activeModal) return null

  const tagSuggestions = spaceProblems.flatMap((problem) => (Array.isArray(problem.tags) ? problem.tags : []))

  if (activeModal === 'upload-space-problem') {
    return (
      <ProblemEditor open mode="create" createTitle="新建题目" createSubmitText="保存题目"
        tagSuggestions={tagSuggestions} onClose={onClose} onSubmit={onCreateSpaceProblem} />
    )
  }

  if (activeModal === 'edit-space-problem') {
    if (!modalState.editingSpaceProblem) return null
    return (
      <ProblemEditor open mode="edit" problem={modalState.editingSpaceProblem}
        editTitle={modalState.editingProblemId ? `编辑题目 #${modalState.editingProblemId}` : '编辑题目'}
        editSubmitText="保存修改" tagSuggestions={tagSuggestions} onClose={onClose}
        onSubmit={onSaveEditedSpaceProblem} />
    )
  }

  if (activeModal === 'create-training-plan') {
    return <TrainingPlanEditor open mode="create" problemOptions={spaceProblems} onClose={onClose} onSubmit={onCreateTrainingPlan} />
  }

  if (activeModal === 'edit-training-plan') {
    if (!modalState.editingTrainingPlan) return null
    return <TrainingPlanEditor open mode="edit" plan={modalState.editingTrainingPlan} problemOptions={spaceProblems} onClose={onClose} onSubmit={onSaveEditedTrainingPlan} />
  }

  if (activeModal === 'create-homework') {
    return <HomeworkEditor open mode="create" problemOptions={spaceProblems} onClose={onClose} onSubmit={onCreateHomework} />
  }

  if (activeModal === 'edit-homework') {
    if (!modalState.editingHomework) return null
    return <HomeworkEditor open mode="edit" homework={modalState.editingHomework} problemOptions={spaceProblems} onClose={onClose} onSubmit={onSaveEditedHomework} />
  }

  if (activeModal === 'create-space') {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>新建空间</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <Input placeholder="空间名称" value={modalState.newSpaceName}
              onChange={(e) => modalState.setNewSpaceName(e.target.value)} />
            <Textarea placeholder="空间描述（可选）" value={modalState.newSpaceDesc}
              onChange={(e) => modalState.setNewSpaceDesc(e.target.value)} />
            <div className="flex gap-3">
              <Button onClick={onCreateSpace}>创建空间</Button>
              <Button variant="outline" onClick={onClose}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (activeModal === 'space-settings') {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑空间设置</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <Input placeholder="空间名称" value={modalState.spaceSettingsName}
              onChange={(e) => modalState.setSpaceSettingsName(e.target.value)} />
            <Textarea placeholder="空间描述" value={modalState.spaceSettingsDescription}
              onChange={(e) => modalState.setSpaceSettingsDescription(e.target.value)} />
            <Label className="flex flex-col gap-2">
              默认编程语言
              <Select value={modalState.spaceDefaultLanguage} onValueChange={modalState.setSpaceDefaultLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="go">Go</SelectItem>
                </SelectContent>
              </Select>
            </Label>
            <div className="flex gap-3">
              <Button disabled={modalState.spaceSettingsSubmitting} onClick={onUpdateSpaceSettings}>
                {modalState.spaceSettingsSubmitting ? '保存中...' : '保存设置'}
              </Button>
              <Button variant="outline" onClick={onClose}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (activeModal === 'assign-training-participant') {
    const title = modalState.assigningTrainingPlan ? `分配训练成员：${modalState.assigningTrainingPlan.title}` : '分配训练成员'
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <Input type="number" min="1" placeholder="用户 ID" value={modalState.trainingParticipantUserId}
              onChange={(e) => modalState.setTrainingParticipantUserId(e.target.value)} />
            <div className="flex gap-3">
              <Button disabled={modalState.trainingParticipantSubmitting} onClick={onAddTrainingParticipant}>
                {modalState.trainingParticipantSubmitting ? '分配中...' : '确认分配'}
              </Button>
              <Button variant="outline" onClick={onClose}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (activeModal === 'assign-homework-target') {
    const title = modalState.assigningHomework ? `分配作业成员：${modalState.assigningHomework.title}` : '分配作业成员'
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <MemberComboBox
              candidates={homeworkTargetCandidates}
              selectedUsers={selectedHomeworkTargetUsers}
              inputValue={homeworkTargetInput}
              loading={homeworkTargetSearchLoading}
              onInputChange={setHomeworkTargetInput}
              onSelectionChange={setSelectedHomeworkTargetUsers}
            />
            <div className="flex gap-3">
              <Button disabled={modalState.homeworkTargetSubmitting || selectedHomeworkTargetUsers.length === 0}
                onClick={() => onAddHomeworkTarget(selectedHomeworkTargetUsers)}>
                {modalState.homeworkTargetSubmitting ? '分配中...' : `确认分配${selectedHomeworkTargetUsers.length > 0 ? `（${selectedHomeworkTargetUsers.length}）` : ''}`}
              </Button>
              <Button variant="outline" onClick={onClose}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (activeModal === 'admin-reset-password') {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>重置任意用户密码</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <Input type="number" min="1" placeholder="用户 ID" value={modalState.adminResetUserId}
              onChange={(e) => modalState.setAdminResetUserId(e.target.value)} />
            <div className="flex gap-3">
              <Button disabled={modalState.adminResetSubmitting} onClick={onAdminResetPassword}>
                {modalState.adminResetSubmitting ? '重置中...' : '重置为123456'}
              </Button>
              <Button variant="outline" onClick={onClose}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (activeModal === 'batch-register') {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>批量注册用户</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">每行格式：<code className="bg-muted px-1 rounded">用户名,密码</code>，密码至少 6 位。</p>
            <Textarea className="font-mono min-h-[180px]"
              value={modalState.batchInput}
              onChange={(e) => modalState.setBatchInput(e.target.value)}
              placeholder={'student01,123456\nstudent02,123456'} />
            <Label className="flex flex-col gap-2">
              加入空间（可选）
              <Select value={modalState.batchSpaceId || '__none__'} onValueChange={(v) => modalState.setBatchSpaceId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="不加入空间" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">不加入空间</SelectItem>
                  {spaces.map((space) => (
                    <SelectItem key={space.id} value={String(space.id)}>{space.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <div className="flex gap-3">
              <Button disabled={modalState.batchSubmitting} onClick={onBatchRegister}>
                {modalState.batchSubmitting ? '处理中...' : '开始批量注册'}
              </Button>
              <Button variant="outline" onClick={onClose}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return null
}
