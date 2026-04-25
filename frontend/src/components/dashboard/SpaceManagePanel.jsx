import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ToastMessage from '../ToastMessage'

function SummaryItem({ label, value }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.25 }}>
        {value}
      </Typography>
    </Paper>
  )
}

function ProblemRow({ text, actions }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 2
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Typography
          variant="body2"
          sx={{
            minWidth: 0,
            flexGrow: 1,
            fontWeight: 500
          }}
          noWrap
          title={text}
        >
          {text}
        </Typography>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {actions}
        </Stack>
      </Stack>
    </Paper>
  )
}

export default function SpaceManagePanel({
  hasAnySpaceAdminRole,
  selectedSpace,
  canManageSelectedSpace,
  spaceManageTab,
  onSpaceManageTabChange,
  normalizeLanguage,
  openSpaceSettingsModal,
  spaceSettingsMessage,
  spaceProblemSearch,
  onSpaceProblemSearchChange,
  filteredSpaceRootProblems,
  linkedProblemIDSet,
  onAddProblemToSpace,
  spaceProblems,
  problemTypeText,
  editingProblemId,
  onOpenEditProblem,
  onRemoveSpaceProblem,
  spaceMembers,
  memberRole,
  onMemberRoleChange,
  memberCandidateInput,
  onMemberCandidateInputChange,
  memberCandidates,
  selectedMemberCandidates,
  onSelectedMemberCandidatesChange,
  memberSearchLoading,
  onSubmitMembers,
  memberSubmitting,
  onResetMemberPassword,
  resettingMemberId,
  onRemoveMember,
  removingMemberId,
  memberMessage,
  openUploadProblemModal,
  selectedSpaceId
}) {
  const handleTabChange = (event, newValue) => {
    onSpaceManageTabChange(newValue)
  }

  const renderMemberLabel = (member) => {
    if (!member) return ''
    const parts = [`#${member.userId || member.id}`, member.username]
    if (member.globalRole === 'system_admin') {
      parts.push('系统管理员')
    }
    parts.push(member.role === 'space_admin' ? '空间管理员' : '成员')
    return parts.join(' · ')
  }

  const getCandidateLabel = (candidate) => {
    if (!candidate) return ''
    const parts = [`#${candidate.id}`, candidate.username]
    if (candidate.globalRole === 'system_admin') {
      parts.push('系统管理员')
    }
    return parts.join(' · ')
  }

  if (!hasAnySpaceAdminRole) {
    return (
      <Paper sx={{ p: 3, borderRadius: 3 }}>
        <ToastMessage message="当前账号没有空间管理员权限。" severity="info" />
        <Typography variant="h6" fontWeight={700} gutterBottom>
          空间管理
        </Typography>
        <Typography color="text.secondary">
          当前账号只能浏览空间，不能修改空间设置、题库或成员。
        </Typography>
      </Paper>
    )
  }

  return (
    <Box>
      {!selectedSpace && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            还没有选中空间
          </Typography>
          <Typography color="text.secondary">
            从上方选择空间后，这里才会显示对应的管理内容。
          </Typography>
        </Paper>
      )}

      {!canManageSelectedSpace && selectedSpace && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <ToastMessage message="当前账号不是该空间管理员，请切换到你管理的空间。" severity="warning" />
          <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 1.5 }}>
            已选空间：#{selectedSpace.id} {selectedSpace.name}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            你当前只能查看这个空间，不能修改其设置、题库或成员。
          </Typography>
        </Paper>
      )}

      {selectedSpace && canManageSelectedSpace && (
        <>
          <Paper sx={{ mb: 3, borderRadius: 3 }}>
            <Tabs value={spaceManageTab} onChange={handleTabChange} variant="fullWidth">
              <Tab label="空间设置" value="settings" />
              <Tab label="题库设置" value="problems" />
              <Tab label="成员管理" value="members" />
            </Tabs>
          </Paper>

          {spaceManageTab === 'settings' && (
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
              >
                <Box>
                  <Typography variant="h6" fontWeight={700}>
                    空间设置
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    #{selectedSpace.id} {selectedSpace.name} 的基础信息和默认语言。
                  </Typography>
                </Box>
                <Button variant="contained" onClick={openSpaceSettingsModal}>
                  编辑空间设置
                </Button>
              </Stack>

              <Box
                sx={{
                  mt: 2.5,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1.5
                }}
              >
                <SummaryItem label="空间名称" value={selectedSpace.name || '-'} />
                <SummaryItem label="默认语言" value={normalizeLanguage(selectedSpace.defaultProgrammingLanguage || 'cpp')} />
                <SummaryItem label="空间题目数" value={spaceProblems.length} />
              </Box>

              <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  空间描述
                </Typography>
                <Typography color="text.secondary">
                  {selectedSpace.description || '暂无描述'}
                </Typography>
              </Paper>

              {spaceSettingsMessage && <Box sx={{ mt: 2 }}><ToastMessage message={spaceSettingsMessage} severity="success" /></Box>}
            </Paper>
          )}

          {spaceManageTab === 'problems' && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1fr) minmax(0, 1fr)' },
                gap: 3
              }}
            >
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" fontWeight={700}>
                  从根题库添加
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="按题目 ID、标题或标签搜索"
                  value={spaceProblemSearch}
                  onChange={(event) => onSpaceProblemSearchChange(event.target.value)}
                  sx={{ mt: 2 }}
                />

                <Stack spacing={1.25} sx={{ mt: 2.5, maxHeight: 620, overflowY: 'auto', pr: 0.25 }}>
                  {filteredSpaceRootProblems.length === 0 ? (
                    <Typography color="text.secondary">
                      当前检索条件下没有可显示的根题。
                    </Typography>
                  ) : (
                    filteredSpaceRootProblems.map((problem) => {
                      const linked = linkedProblemIDSet.has(problem.id)
                      const tagsText = (problem.tags || []).join(' / ')
                      const lineText = [`#${problem.id}`, problem.title, problemTypeText(problem.type), tagsText].filter(Boolean).join(' · ')
                      return (
                        <ProblemRow
                          key={problem.id}
                          text={lineText}
                          actions={(
                            <Button
                              size="small"
                              variant={linked ? 'outlined' : 'contained'}
                              disabled={linked}
                              onClick={() => onAddProblemToSpace(problem.id)}
                            >
                              {linked ? '已添加' : '添加'}
                            </Button>
                          )}
                        />
                      )
                    })
                  )}
                </Stack>
              </Paper>

              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                >
                  <Box>
                    <Typography variant="h6" fontWeight={700}>
                      当前空间题库
                    </Typography>
                  </Box>
                  <Button variant="contained" onClick={openUploadProblemModal}>
                    上传新题目
                  </Button>
                </Stack>

                <Stack spacing={1.25} sx={{ mt: 2.5, maxHeight: 620, overflowY: 'auto', pr: 0.25 }}>
                  {spaceProblems.length === 0 ? (
                    <Typography color="text.secondary">
                      当前空间暂无题目。
                    </Typography>
                  ) : (
                    spaceProblems.map((problem) => {
                      const tagsText = (problem.tags || []).join(' / ')
                      const lineText = [
                        `#${problem.id}`,
                        problem.title,
                        problemTypeText(problem.type),
                        `${problem.timeLimitMs}ms`,
                        `${problem.memoryLimitMiB}MiB`,
                        tagsText
                      ].filter(Boolean).join(' · ')

                      return (
                        <ProblemRow
                          key={problem.id}
                          text={lineText}
                          actions={(
                            <>
                              <Button
                                size="small"
                                component={Link}
                                to={`/spaces/${selectedSpaceId}/problems/${problem.id}/solve`}
                                variant="outlined"
                              >
                                去做题
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => onOpenEditProblem(problem.id)}
                              >
                                编辑
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                variant="outlined"
                                onClick={() => onRemoveSpaceProblem(problem.id)}
                              >
                                移除
                              </Button>
                            </>
                          )}
                        />
                      )
                    })
                  )}
                </Stack>

                {editingProblemId && <Box sx={{ mt: 2 }}><ToastMessage message="题目编辑弹窗已打开。" severity="info" /></Box>}
              </Paper>
            </Box>
          )}

          {spaceManageTab === 'members' && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', xl: 'minmax(320px, 420px) minmax(0, 1fr)' },
                gap: 3
              }}
            >
              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" fontWeight={700}>
                  添加成员
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  按用户 ID 或用户名搜索，选中后加入当前空间。
                </Typography>

                <TextField
                  select
                  fullWidth
                  size="small"
                  label="加入后角色"
                  value={memberRole}
                  onChange={(event) => onMemberRoleChange(event.target.value)}
                  sx={{ mt: 2 }}
                >
                  <MenuItem value="member">成员</MenuItem>
                  <MenuItem value="space_admin">空间管理员</MenuItem>
                </TextField>

                <Autocomplete
                  multiple
                  options={memberCandidates}
                  value={selectedMemberCandidates}
                  inputValue={memberCandidateInput}
                  loading={memberSearchLoading}
                  onInputChange={(event, value) => onMemberCandidateInputChange(value)}
                  onChange={(event, value) => onSelectedMemberCandidatesChange(value)}
                  getOptionLabel={getCandidateLabel}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  filterOptions={(options) => options}
                  noOptionsText={memberCandidateInput.trim() ? '没有匹配用户' : '输入用户 ID 或用户名开始搜索'}
                  loadingText="搜索中..."
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="搜索并选择用户"
                      placeholder="例如：12 或 alice"
                      size="small"
                      sx={{ mt: 2 }}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {memberSearchLoading ? <CircularProgress color="inherit" size={16} /> : null}
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
                        {getCandidateLabel(option)}
                      </Box>
                    )
                  }}
                />

                <Button
                  variant="contained"
                  onClick={onSubmitMembers}
                  disabled={memberSubmitting || selectedMemberCandidates.length === 0}
                  sx={{ mt: 2 }}
                >
                  {memberSubmitting ? '添加中...' : `添加所选用户${selectedMemberCandidates.length > 0 ? `（${selectedMemberCandidates.length}）` : ''}`}
                </Button>

                {memberMessage && <Box sx={{ mt: 2 }}><ToastMessage message={memberMessage} severity="success" /></Box>}
              </Paper>

              <Paper sx={{ p: 3, borderRadius: 3 }}>
                <Typography variant="h6" fontWeight={700}>
                  当前空间成员
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  当前共有 {spaceMembers.length} 名成员。可直接重置密码或移出空间。
                </Typography>

                <Stack spacing={1.25} sx={{ mt: 2.5, maxHeight: 620, overflowY: 'auto', pr: 0.25 }}>
                  {spaceMembers.length === 0 ? (
                    <Typography color="text.secondary">
                      当前空间还没有成员。
                    </Typography>
                  ) : (
                    spaceMembers.map((member) => (
                      <ProblemRow
                        key={member.userId}
                        text={renderMemberLabel(member)}
                        actions={(
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={resettingMemberId === member.userId}
                              onClick={() => onResetMemberPassword(member)}
                            >
                              {resettingMemberId === member.userId ? '重置中...' : '重置密码'}
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              disabled={removingMemberId === member.userId}
                              onClick={() => onRemoveMember(member)}
                            >
                              {removingMemberId === member.userId ? '移除中...' : '移除'}
                            </Button>
                          </>
                        )}
                      />
                    ))
                  )}
                </Stack>
              </Paper>
            </Box>
          )}
        </>
      )}
    </Box>
  )
}
