import { useEffect, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import TextField from '@mui/material/TextField'
import HomeworkEditor from './HomeworkEditor'
import ProblemEditor from './ProblemEditor'
import TrainingPlanEditor from './TrainingPlanEditor'
import { api } from '../../api'

function SimpleModal({ title, onClose, children }) {
  return (
    <div className="modal-mask" onClick={onClose}>
      <section className="modal-card" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="ghost-btn btn-link" onClick={onClose}>关闭</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </section>
    </div>
  )
}

export default function DashboardDialogs({
  modalState,
  onClose,
  spaceProblems,
  spaces,
  onCreateSpace,
  onUpdateSpaceSettings,
  onCreateSpaceProblem,
  onSaveEditedSpaceProblem,
  onCreateTrainingPlan,
  onSaveEditedTrainingPlan,
  onAddTrainingParticipant,
  onCreateHomework,
  onSaveEditedHomework,
  onAddHomeworkTarget,
  onAdminResetPassword,
  onBatchRegister,
  selectedSpaceId
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
    if (!keyword) {
      setHomeworkTargetCandidates([])
      setHomeworkTargetSearchLoading(false)
      return undefined
    }

    let active = true
    const timer = window.setTimeout(async () => {
      try {
        setHomeworkTargetSearchLoading(true)
        const list = await api.searchHomeworkTargetCandidates(selectedSpaceId, assigningHomeworkId, keyword)
        if (!active) return
        setHomeworkTargetCandidates(list || [])
      } catch {
        if (!active) return
        setHomeworkTargetCandidates([])
      } finally {
        if (active) {
          setHomeworkTargetSearchLoading(false)
        }
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeModal, selectedSpaceId, assigningHomeworkId, homeworkTargetInput])

  if (!activeModal) return null

  const tagSuggestions = spaceProblems.flatMap((problem) => (Array.isArray(problem.tags) ? problem.tags : []))
  const getUserLabel = (user) => {
    if (!user) return ''
    const parts = [`#${user.id || user.userId}`, user.username]
    if (user.globalRole === 'system_admin') {
      parts.push('系统管理员')
    }
    if (user.role === 'space_admin') {
      parts.push('空间管理员')
    } else if (user.role) {
      parts.push('成员')
    }
    return parts.filter(Boolean).join(' · ')
  }

  if (activeModal === 'upload-space-problem') {
    return (
      <ProblemEditor
        open
        mode="create"
        createTitle="新建题目"
        createSubmitText="保存题目"
        tagSuggestions={tagSuggestions}
        onClose={onClose}
        onSubmit={onCreateSpaceProblem}
      />
    )
  }

  if (activeModal === 'edit-space-problem') {
    if (!modalState.editingSpaceProblem) return null
    return (
      <ProblemEditor
        open
        mode="edit"
        problem={modalState.editingSpaceProblem}
        editTitle={modalState.editingProblemId ? `编辑题目 #${modalState.editingProblemId}` : '编辑题目'}
        editSubmitText="保存修改"
        tagSuggestions={tagSuggestions}
        onClose={onClose}
        onSubmit={onSaveEditedSpaceProblem}
      />
    )
  }

  if (activeModal === 'create-training-plan') {
    return (
      <TrainingPlanEditor
        open
        mode="create"
        problemOptions={spaceProblems}
        onClose={onClose}
        onSubmit={onCreateTrainingPlan}
      />
    )
  }

  if (activeModal === 'edit-training-plan') {
    if (!modalState.editingTrainingPlan) return null
    return (
      <TrainingPlanEditor
        open
        mode="edit"
        plan={modalState.editingTrainingPlan}
        problemOptions={spaceProblems}
        onClose={onClose}
        onSubmit={onSaveEditedTrainingPlan}
      />
    )
  }

  if (activeModal === 'create-homework') {
    return (
      <HomeworkEditor
        open
        mode="create"
        problemOptions={spaceProblems}
        onClose={onClose}
        onSubmit={onCreateHomework}
      />
    )
  }

  if (activeModal === 'edit-homework') {
    if (!modalState.editingHomework) return null
    return (
      <HomeworkEditor
        open
        mode="edit"
        homework={modalState.editingHomework}
        problemOptions={spaceProblems}
        onClose={onClose}
        onSubmit={onSaveEditedHomework}
      />
    )
  }

  if (activeModal === 'create-space') {
    return (
      <SimpleModal title="新建空间" onClose={onClose}>
        <div className="config-form">
          <input
            placeholder="空间名称"
            value={modalState.newSpaceName}
            onChange={(event) => modalState.setNewSpaceName(event.target.value)}
          />
          <textarea
            placeholder="空间描述（可选）"
            value={modalState.newSpaceDesc}
            onChange={(event) => modalState.setNewSpaceDesc(event.target.value)}
          />
          <div className="inline-form">
            <button onClick={onCreateSpace}>创建空间</button>
            <button className="ghost-btn btn-link" onClick={onClose}>取消</button>
          </div>
        </div>
      </SimpleModal>
    )
  }

  if (activeModal === 'space-settings') {
    return (
      <SimpleModal title="编辑空间设置" onClose={onClose}>
        <div className="config-form">
          <input
            placeholder="空间名称"
            value={modalState.spaceSettingsName}
            onChange={(event) => modalState.setSpaceSettingsName(event.target.value)}
          />
          <textarea
            placeholder="空间描述"
            value={modalState.spaceSettingsDescription}
            onChange={(event) => modalState.setSpaceSettingsDescription(event.target.value)}
          />
          <label className="inline-field">
            默认编程语言
            <select value={modalState.spaceDefaultLanguage} onChange={(event) => modalState.setSpaceDefaultLanguage(event.target.value)}>
              <option value="cpp">C++</option>
              <option value="python">Python</option>
              <option value="go">Go</option>
            </select>
          </label>
          <div className="inline-form">
            <button disabled={modalState.spaceSettingsSubmitting} onClick={onUpdateSpaceSettings}>
              {modalState.spaceSettingsSubmitting ? '保存中...' : '保存设置'}
            </button>
            <button className="ghost-btn btn-link" onClick={onClose}>取消</button>
          </div>
        </div>
      </SimpleModal>
    )
  }

  if (activeModal === 'assign-training-participant') {
    const title = modalState.assigningTrainingPlan ? `分配训练成员：${modalState.assigningTrainingPlan.title}` : '分配训练成员'
    return (
      <SimpleModal title={title} onClose={onClose}>
        <div className="config-form">
          <input
            type="number"
            min="1"
            placeholder="用户 ID"
            value={modalState.trainingParticipantUserId}
            onChange={(event) => modalState.setTrainingParticipantUserId(event.target.value)}
          />
          <div className="inline-form">
            <button disabled={modalState.trainingParticipantSubmitting} onClick={onAddTrainingParticipant}>
              {modalState.trainingParticipantSubmitting ? '分配中...' : '确认分配'}
            </button>
            <button className="ghost-btn btn-link" onClick={onClose}>取消</button>
          </div>
        </div>
      </SimpleModal>
    )
  }

  if (activeModal === 'assign-homework-target') {
    const title = modalState.assigningHomework ? `分配作业成员：${modalState.assigningHomework.title}` : '分配作业成员'
    return (
      <SimpleModal title={title} onClose={onClose}>
        <div className="config-form">
          <Autocomplete
            multiple
            options={homeworkTargetCandidates}
            value={selectedHomeworkTargetUsers}
            inputValue={homeworkTargetInput}
            loading={homeworkTargetSearchLoading}
            onInputChange={(event, value) => setHomeworkTargetInput(value)}
            onChange={(event, value) => setSelectedHomeworkTargetUsers(value)}
            getOptionLabel={getUserLabel}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            filterOptions={(options) => options}
            noOptionsText={homeworkTargetInput.trim() ? '没有匹配用户' : '输入用户 ID 或用户名开始搜索'}
            loadingText="搜索中..."
            renderInput={(params) => (
              <TextField
                {...params}
                label="搜索并选择用户"
                placeholder="例如：12 或 alice"
                size="small"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {homeworkTargetSearchLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
              />
            )}
            renderOption={(props, option) => {
              const { key, ...optionProps } = props
              return (
                <Box component="li" key={key} {...optionProps}>
                  {getUserLabel(option)}
                </Box>
              )
            }}
          />
          <div className="inline-form">
            <button
              disabled={modalState.homeworkTargetSubmitting || selectedHomeworkTargetUsers.length === 0}
              onClick={() => onAddHomeworkTarget(selectedHomeworkTargetUsers)}
            >
              {modalState.homeworkTargetSubmitting ? '分配中...' : `确认分配${selectedHomeworkTargetUsers.length > 0 ? `（${selectedHomeworkTargetUsers.length}）` : ''}`}
            </button>
            <button className="ghost-btn btn-link" onClick={onClose}>取消</button>
          </div>
        </div>
      </SimpleModal>
    )
  }

  if (activeModal === 'admin-reset-password') {
    return (
      <SimpleModal title="重置任意用户密码" onClose={onClose}>
        <div className="config-form">
          <input
            type="number"
            min="1"
            placeholder="用户 ID"
            value={modalState.adminResetUserId}
            onChange={(event) => modalState.setAdminResetUserId(event.target.value)}
          />
          <div className="inline-form">
            <button disabled={modalState.adminResetSubmitting} onClick={onAdminResetPassword}>
              {modalState.adminResetSubmitting ? '重置中...' : '重置为123456'}
            </button>
            <button className="ghost-btn btn-link" onClick={onClose}>取消</button>
          </div>
        </div>
      </SimpleModal>
    )
  }

  if (activeModal === 'batch-register') {
    return (
      <SimpleModal title="批量注册用户" onClose={onClose}>
        <div className="config-form">
          <p className="muted">每行格式：<code>用户名,密码</code>，密码至少 6 位。</p>
          <textarea
            className="mono batch-input"
            value={modalState.batchInput}
            onChange={(event) => modalState.setBatchInput(event.target.value)}
            placeholder={'student01,123456\nstudent02,123456'}
          />
          <label className="inline-field">
            加入空间（可选）
            <select value={modalState.batchSpaceId} onChange={(event) => modalState.setBatchSpaceId(event.target.value)}>
              <option value="">不加入空间</option>
              {spaces.map((space) => (
                <option key={space.id} value={String(space.id)}>{space.name}</option>
              ))}
            </select>
          </label>
          <div className="inline-form">
            <button disabled={modalState.batchSubmitting} onClick={onBatchRegister}>
              {modalState.batchSubmitting ? '处理中...' : '开始批量注册'}
            </button>
            <button className="ghost-btn btn-link" onClick={onClose}>取消</button>
          </div>
        </div>
      </SimpleModal>
    )
  }

  return null
}
