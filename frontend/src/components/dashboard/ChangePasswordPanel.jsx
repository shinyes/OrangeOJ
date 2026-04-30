import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ToastMessage from '../ToastMessage'

export default function ChangePasswordPanel({
  oldPassword,
  newPassword,
  confirmPassword,
  onOldPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  submitting,
  onSubmit,
  onCancel,
  message,
  onMessageShown
}) {
  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        修改密码
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          type="password"
          placeholder="旧密码"
          value={oldPassword}
          onChange={(event) => onOldPasswordChange(event.target.value)}
          size="small"
        />
        <TextField
          type="password"
          placeholder="新密码（至少6 位）"
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          size="small"
        />
        <TextField
          type="password"
          placeholder="确认新密码"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          size="small"
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            disabled={submitting}
            onClick={onSubmit}
          >
            {submitting ? '提交中...' : '确认修改密码'}
          </Button>
          <Button variant="outlined" onClick={onCancel}>
            取消
          </Button>
        </Box>
        {message && (
          <ToastMessage message={message} severity="success" onShown={onMessageShown} />
        )}
      </Box>
    </Paper>
  )
}
