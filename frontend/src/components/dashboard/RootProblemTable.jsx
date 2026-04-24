import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Chip from '@mui/material/Chip'
import ToastMessage from '../ToastMessage'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RootProblemCreator from './RootProblemCreator'

export default function RootProblemTable({
  rootProblems,
  search,
  onSearchChange,
  onCreate,
  onUpdate,
  onDelete,
  problemTypeText
}) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingProblem, setEditingProblem] = useState(null)
  const [deletingProblem, setDeletingProblem] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const filteredRootProblems = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rootProblems

    return rootProblems.filter((problem) => {
      const tagsText = Array.isArray(problem.tags) ? problem.tags.join(' ').toLowerCase() : ''
      return (
        String(problem.id).includes(keyword) ||
        String(problem.title || '').toLowerCase().includes(keyword) ||
        tagsText.includes(keyword)
      )
    })
  }, [rootProblems, search])
  const tagSuggestions = useMemo(
    () => rootProblems.flatMap((problem) => (Array.isArray(problem.tags) ? problem.tags : [])),
    [rootProblems]
  )

  const handleCreate = async (problemData) => {
    await onCreate(problemData)
    setCreateDialogOpen(false)
  }

  const handleUpdate = async (problemData) => {
    if (!editingProblem) return
    await onUpdate(editingProblem.id, problemData)
    setEditingProblem(null)
  }

  const openDeleteDialog = (problem) => {
    setDeleteError('')
    setDeletingProblem(problem)
  }

  const closeDeleteDialog = () => {
    if (deleting) return
    setDeleteError('')
    setDeletingProblem(null)
  }

  const confirmDelete = async () => {
    if (!deletingProblem) return

    try {
      setDeleting(true)
      setDeleteError('')
      await onDelete(deletingProblem.id)
      setDeletingProblem(null)
    } catch (err) {
      setDeleteError(err.message || '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Box sx={{ mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h2">根题库管理</Typography>
          <Button variant="contained" color="primary" onClick={() => setCreateDialogOpen(true)}>
            新建根题
          </Button>
        </Box>

        <TextField
          fullWidth
          placeholder="搜索根题（ID / 标题 / 标签）"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          sx={{ mb: 3 }}
        />

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>标题</TableCell>
                <TableCell>标签</TableCell>
                <TableCell>类型</TableCell>
                <TableCell>时间限制</TableCell>
                <TableCell>内存限制</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRootProblems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">没有匹配的题目</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRootProblems.map((problem) => (
                  <TableRow key={problem.id} hover>
                    <TableCell>#{problem.id}</TableCell>
                    <TableCell>{problem.title}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {(problem.tags || []).length > 0 ? (
                          problem.tags.map((tag) => (
                            <Chip key={`${problem.id}-${tag}`} label={tag} size="small" variant="outlined" />
                          ))
                        ) : (
                          <Typography variant="caption" color="text.secondary">无标签</Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={problemTypeText(problem.type)} size="small" />
                    </TableCell>
                    <TableCell>{problem.timeLimitMs} ms</TableCell>
                    <TableCell>{problem.memoryLimitMiB} MiB</TableCell>
                    <TableCell align="right">
                      <Tooltip title="编辑">
                        <IconButton size="small" color="primary" onClick={() => setEditingProblem(problem)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error" onClick={() => openDeleteDialog(problem)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <RootProblemCreator
        open={createDialogOpen}
        mode="create"
        tagSuggestions={tagSuggestions}
        onClose={() => setCreateDialogOpen(false)}
        onSubmit={handleCreate}
      />

      <RootProblemCreator
        open={Boolean(editingProblem)}
        mode="edit"
        problem={editingProblem}
        tagSuggestions={tagSuggestions}
        onClose={() => setEditingProblem(null)}
        onSubmit={handleUpdate}
      />

      <Dialog open={Boolean(deletingProblem)} onClose={closeDeleteDialog} maxWidth="xs" fullWidth>
        <DialogTitle>删除题目</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            {deletingProblem ? `确认删除题目 #${deletingProblem.id}「${deletingProblem.title}」吗？` : ''}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            如果该题目仍被作业、训练或提交记录引用，系统会拒绝删除。
          </Typography>
          {deleteError && <ToastMessage message={deleteError} severity="error" onShown={() => setDeleteError('')} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={deleting}>取消</Button>
          <Button color="error" variant="contained" onClick={confirmDelete} disabled={deleting}>
            {deleting ? '删除中...' : '确认删除'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
