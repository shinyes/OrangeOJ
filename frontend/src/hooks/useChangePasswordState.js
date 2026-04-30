import { useCallback, useState } from 'react'

export default function useChangePasswordState() {
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false)
  const [changePasswordMessage, setChangePasswordMessage] = useState('')

  const openChangePassword = useCallback(() => {
    setChangePasswordMessage('')
    setChangePasswordOpen(true)
  }, [])

  const closeChangePassword = useCallback(() => {
    setChangePasswordOpen(false)
  }, [])

  return {
    changePasswordOpen,
    setChangePasswordOpen,
    openChangePassword,
    closeChangePassword,
    oldPassword,
    setOldPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    changePasswordSubmitting,
    setChangePasswordSubmitting,
    changePasswordMessage,
    setChangePasswordMessage
  }
}
