import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import ToastMessage from '../ToastMessage'

export default function ChangePasswordPanel({
  open, oldPassword, newPassword, confirmPassword,
  onOldPasswordChange, onNewPasswordChange, onConfirmPasswordChange,
  submitting, onSubmit, onCancel, message, onMessageShown
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>修改密码</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <Input type="password" placeholder="旧密码" value={oldPassword}
            onChange={(e) => onOldPasswordChange(e.target.value)} />
          <Input type="password" placeholder="新密码（至少6 位）" value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)} />
          <Input type="password" placeholder="确认新密码" value={confirmPassword}
            onChange={(e) => onConfirmPasswordChange(e.target.value)} />
          <div className="flex gap-2">
            <Button disabled={submitting} onClick={onSubmit}>
              {submitting ? '提交中...' : '确认修改密码'}
            </Button>
            <Button variant="outline" onClick={onCancel}>取消</Button>
          </div>
          {message && <ToastMessage message={message} severity="success" onShown={onMessageShown} />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
