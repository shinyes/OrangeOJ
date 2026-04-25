import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
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

function ProblemCard({
  problem,
  problemTypeText,
  metaText,
  actions
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <Typography variant="subtitle2" fontWeight={700}>
              #{problem.id} {problem.title}
            </Typography>
            <Chip size="small" label={problemTypeText(problem.type)} variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            {metaText}
          </Typography>
          {(problem.tags || []).length > 0 && (
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
              {problem.tags.map((tag) => (
                <Chip key={`${problem.id}-${tag}`} label={tag} size="small" variant="outlined" />
              ))}
            </Stack>
          )}
        </Box>

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
  openAddMemberModal,
  openResetMemberPasswordModal,
  memberMessage,
  memberResetMessage,
  openUploadProblemModal,
  selectedSpaceId
}) {
  const handleTabChange = (event, newValue) => {
    onSpaceManageTabChange(newValue)
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
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  搜索后直接加入当前空间题库。
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
                      return (
                        <ProblemCard
                          key={problem.id}
                          problem={problem}
                          problemTypeText={problemTypeText}
                          metaText={linked ? '已在当前空间题库中' : '可添加到当前空间题库'}
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
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      #{selectedSpace.id} {selectedSpace.name} 内可见的题目。
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
                    spaceProblems.map((problem) => (
                      <ProblemCard
                        key={problem.id}
                        problem={problem}
                        problemTypeText={problemTypeText}
                        metaText={`${problem.timeLimitMs}ms | ${problem.memoryLimitMiB}MiB`}
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
                    ))
                  )}
                </Stack>

                {editingProblemId && <Box sx={{ mt: 2 }}><ToastMessage message="题目编辑弹窗已打开。" severity="info" /></Box>}
              </Paper>
            </Box>
          )}

          {spaceManageTab === 'members' && (
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Typography variant="h6" fontWeight={700}>
                成员管理
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                这里只保留两个高频入口：添加成员和重置成员密码。
              </Typography>

              <Box
                sx={{
                  mt: 2.5,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2
                }}
              >
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    添加成员 / 管理员
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    将已注册用户加入当前空间，并设置为普通成员或空间管理员。
                  </Typography>
                  <Button variant="contained" onClick={openAddMemberModal} sx={{ mt: 2 }}>
                    打开添加弹窗
                  </Button>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    重置成员密码
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    仅处理当前空间成员密码，适合排查登录问题。
                  </Typography>
                  <Button variant="outlined" onClick={openResetMemberPasswordModal} sx={{ mt: 2 }}>
                    打开重置弹窗
                  </Button>
                </Paper>
              </Box>

              {memberMessage && <Box sx={{ mt: 2 }}><ToastMessage message={memberMessage} severity="success" /></Box>}
              {memberResetMessage && <Box sx={{ mt: 2 }}><ToastMessage message={memberResetMessage} severity="success" /></Box>}
            </Paper>
          )}
        </>
      )}
    </Box>
  )
}
