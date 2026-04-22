import { Link } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import ToastMessage from '../ToastMessage'

export default function SpaceManagePanel({
  hasAnySpaceAdminRole,
  isSystemAdmin,
  selectedSpace,
  canManageSelectedSpace,
  spaceSelectorKeyword,
  onSpaceSelectorKeywordChange,
  filteredSpacesForManage,
  selectedSpaceId,
  onSelectSpace,
  openCreateSpaceModal,
  spaceManageTab,
  onSpaceManageTabChange,
  normalizeLanguage,
  openSpaceSettingsModal,
  spaceSettingsName,
  onSpaceSettingsNameChange,
  spaceSettingsDescription,
  onSpaceSettingsDescriptionChange,
  spaceDefaultLanguage,
  onSpaceDefaultLanguageChange,
  spaceSettingsSubmitting,
  onUpdateSpaceSettings,
  closeConfigModal,
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
  openUploadProblemModal
}) {
  const handleTabChange = (event, newValue) => {
    onSpaceManageTabChange(newValue)
  }

  if (!hasAnySpaceAdminRole) {
    return (
      <Paper sx={{ p: 3 }}>
        <ToastMessage message="当前账号没有空间管理员权限。" severity="info" />
        <Typography variant="h6" gutterBottom>空间管理</Typography>
      </Paper>
    )
  }

  return (
    <Box>
      {/* Space Selector */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>选择空间</Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="搜索空间名称"
            value={spaceSelectorKeyword}
            onChange={(event) => onSpaceSelectorKeywordChange(event.target.value)}
            sx={{ width: 200 }}
          />
          <FormControl fullWidth size="small" disabled={filteredSpacesForManage.length === 0}>
            <InputLabel>选择空间</InputLabel>
            <Select
              value={selectedSpaceId ? String(selectedSpaceId) : ''}
              label="选择空间"
              onChange={(event) => onSelectSpace(event.target.value ? Number(event.target.value) : null)}
            >
              {filteredSpacesForManage.length === 0 ? (
                <MenuItem value="" disabled>暂无匹配空间</MenuItem>
              ) : (
                filteredSpacesForManage.map((space) => (
                  <MenuItem key={space.id} value={String(space.id)}>
                    #{space.id} {space.name}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Box>
        {isSystemAdmin && (
          <Button variant="contained" onClick={openCreateSpaceModal}>
            新建空间
          </Button>
        )}
      </Paper>

      {!canManageSelectedSpace && selectedSpace && (
        <ToastMessage message="当前账号不是该空间管理员，请切换到你管理的空间。" severity="warning" />
      )}

      {selectedSpace && canManageSelectedSpace && (
        <>
          <Paper sx={{ mb: 3 }}>
            <Tabs value={spaceManageTab} onChange={handleTabChange}>
              <Tab label="空间设置" value="settings" />
              <Tab label="题库设置" value="problems" />
              <Tab label="成员管理" value="members" />
            </Tabs>
          </Paper>

          {spaceManageTab === 'settings' && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>空间设置</Typography>
              <Stack spacing={3} sx={{ mt: 2 }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">空间名称</Typography>
                  <Typography color="text.secondary">{selectedSpace?.name || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">空间描述</Typography>
                  <Typography color="text.secondary">{selectedSpace?.description || '暂无描述'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">默认编程语言</Typography>
                  <Typography color="text.secondary">
                    {normalizeLanguage(selectedSpace?.defaultProgrammingLanguage || 'cpp')}
                  </Typography>
                </Box>
                <Button variant="contained" onClick={openSpaceSettingsModal}>
                  编辑空间设置
                </Button>
              </Stack>
              {spaceSettingsMessage && <ToastMessage message={spaceSettingsMessage} severity="success" />}
            </Paper>
          )}

          {spaceManageTab === 'problems' && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">空间题库设置</Typography>
                <Button variant="contained" onClick={openUploadProblemModal}>
                  上传新题目
                </Button>
              </Box>

              {/* Add from Root Problems */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  从根题库添加到空间
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="按题目 ID 或标题搜索"
                  value={spaceProblemSearch}
                  onChange={(event) => onSpaceProblemSearchChange(event.target.value)}
                  sx={{ mb: 2 }}
                />
                <Stack spacing={1}>
                  {filteredSpaceRootProblems.length === 0 ? (
                    <Typography color="text.secondary">没有可显示的根题。</Typography>
                  ) : (
                    filteredSpaceRootProblems.map((problem) => {
                      const linked = linkedProblemIDSet.has(problem.id)
                      return (
                        <Box
                          key={problem.id}
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            p: 2,
                            bgcolor: linked ? 'action.disabledBackground' : 'background.default',
                            borderRadius: 1
                          }}
                        >
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              #{problem.id} {problem.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {problemTypeText(problem.type)}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant={linked ? 'outlined' : 'contained'}
                            disabled={linked}
                            onClick={() => onAddProblemToSpace(problem.id)}
                          >
                            {linked ? '已在空间题库' : '添加'}
                          </Button>
                        </Box>
                      )
                    })
                  )}
                </Stack>
              </Box>

              {/* Current Space Problems */}
              <Box>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  当前空间题目
                </Typography>
                {spaceProblems.length === 0 ? (
                  <Typography color="text.secondary">当前空间暂无题目。</Typography>
                ) : (
                  <Stack spacing={1}>
                    {spaceProblems.map((problem) => (
                      <Box
                        key={problem.id}
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1
                        }}
                      >
                        <Box>
                          <Typography variant="body2" fontWeight="bold">
                            #{problem.id} {problem.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {problemTypeText(problem.type)} | {problem.timeLimitMs}ms | {problem.memoryLimitMiB}MiB
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
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
                            编辑题目
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => onRemoveSpaceProblem(problem.id)}
                          >
                            从空间移除
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
                {editingProblemId && <ToastMessage message="题目编辑弹窗已打开。" severity="info" />}
              </Box>
            </Paper>
          )}

          {spaceManageTab === 'members' && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>成员管理</Typography>
              <Typography color="text.secondary" paragraph>
                将已注册用户加入当前空间。请输入用户 ID，可设置为成员或空间管理员。
              </Typography>
              <Typography color="text.secondary" paragraph>
                一个空间支持设置多个空间管理员。
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="contained" onClick={openAddMemberModal}>
                  添加成员/管理员
                </Button>
                <Button variant="outlined" onClick={openResetMemberPasswordModal}>
                  重置成员密码
                </Button>
              </Box>
              {memberMessage && <ToastMessage message={memberMessage} severity="success" />}
              {memberResetMessage && <ToastMessage message={memberResetMessage} severity="success" />}
            </Paper>
          )}
        </>
      )}
    </Box>
  )
}
