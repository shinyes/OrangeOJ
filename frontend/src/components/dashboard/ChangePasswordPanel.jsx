import { Button } from '../ui/button'
import { Input } from '../ui/input'
import ToastMessage from '../ToastMessage'

export default function ChangePasswordPanel({
  oldPassword, newPassword, confirmPassword,
  onOldPasswordChange, onNewPasswordChange, onConfirmPasswordChange,
  submitting, onSubmit, onCancel, message, onMessageShown
}) {
  return (
    <div className="border rounded-xl p-6 mb-6 bg-background shadow-sm">
      <h2 className="text-lg font-semibold mb-4">修改密码</h2>
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
    </div>
  )
}
