import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
  problemTypeText 
}) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const filteredRootProblems = useMemo(() => {
    if (!search.trim()) return rootProblems
    const term = search.toLowerCase()
    return rootProblems.filter(p => 
      p.id.toString().includes(term) || 
      p.title.toLowerCase().includes(term)
    )
  }, [rootProblems, search])

  const handleCreate = (problemData) => {
    onCreate(problemData)
    setCreateDialogOpen(false)
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
          placeholder="搜索根题（ID/标题）"
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
                <TableCell>类型</TableCell>
                <TableCell>难度</TableCell>
                <TableCell>时限</TableCell>
                <TableCell>内存</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRootProblems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="textSecondary">没有匹配的题目</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRootProblems.map((problem) => (
                  <TableRow key={problem.id} hover>
                    <TableCell>#{problem.id}</TableCell>
                    <TableCell>{problem.title}</TableCell>
                    <TableCell>
                      <Chip label={problemTypeText(problem.type)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={problem.difficulty || 3} 
                        size="small"
                        color={problem.difficulty <= 2 ? 'success' : problem.difficulty >= 4 ? 'error' : 'warning'}
                      />
                    </TableCell>
                    <TableCell>{problem.timeLimitMs}ms</TableCell>
                    <TableCell>{problem.memoryLimitMiB}MiB</TableCell>
                    <TableCell align="right">
                      <Tooltip title="编辑">
                        <IconButton size="small" color="primary">
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除">
                        <IconButton size="small" color="error">
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
        onClose={() => setCreateDialogOpen(false)}
        onCreate={handleCreate}
      />
    </>
  )
}
