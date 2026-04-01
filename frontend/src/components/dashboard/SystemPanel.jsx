import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

export default function SystemPanel({
  systemTab,
  onSystemTabChange,
  registrationEnabled,
  onToggleRegistration,
  adminResetMessage,
  onOpenAdminResetDialog,
  batchResult,
  onOpenBatchRegisterDialog,
  onCopyBatchResult,
  toFriendlyError
}) {
  const handleTabChange = (event, newValue) => {
    onSystemTabChange(newValue)
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Tabs value={systemTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label="系统设置" value="settings" />
        <Tab label="账号维护" value="account" />
        <Tab label="批量注册" value="batch" />
      </Tabs>

      {systemTab === 'settings' && (
        <Box>
          <Typography variant="h6" gutterBottom>系统设置</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2 }}>
            <Typography>注册开关</Typography>
            <Button 
              variant={registrationEnabled ? 'contained' : 'outlined'}
              onClick={onToggleRegistration}
            >
              {registrationEnabled ? '已开启（点击关闭）' : '已关闭（点击开启）'}
            </Button>
          </Box>
        </Box>
      )}

      {systemTab === 'account' && (
        <Box>
          <Typography variant="h6" gutterBottom>重置用户密码</Typography>
          <Typography color="text.secondary" paragraph>
            系统管理员可将任意用户密码重置为 123456。
          </Typography>
          <Button variant="contained" onClick={onOpenAdminResetDialog}>
            打开重置弹窗
          </Button>
          {adminResetMessage && (
            <Alert severity="success" sx={{ mt: 2 }}>{adminResetMessage}</Alert>
          )}
        </Box>
      )}

      {systemTab === 'batch' && (
        <Box>
          <Typography variant="h6" gutterBottom>批量注册用户</Typography>
          <Typography color="text.secondary" paragraph>
            通过弹窗录入批量账号，提交后结果会展示在下方。
          </Typography>
          <Button variant="contained" onClick={onOpenBatchRegisterDialog}>
            打开批量注册弹窗
          </Button>

          {batchResult && (
            <Box sx={{ mt: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2">
                  总计 {batchResult.total}条，成功{batchResult.successCount}条，失败{batchResult.failureCount}条
                </Typography>
                <IconButton onClick={onCopyBatchResult} size="small">
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>行号</TableCell>
                    <TableCell>用户名</TableCell>
                    <TableCell>结果</TableCell>
                    <TableCell>说明</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {batchResult.results.map((row) => (
                    <TableRow key={row.index}>
                      <TableCell>{row.index}</TableCell>
                      <TableCell>{row.username || '(空)'}</TableCell>
                      <TableCell>
                        <Typography 
                          color={row.success ? 'success.main' : 'error.main'}
                          fontWeight="bold"
                        >
                          {row.success ? '成功' : '失败'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {row.success 
                          ? `用户 ID: ${row.userId}`
                          : toFriendlyError(row.reason || '未知错误')
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  )
}
