import { api, toFriendlyError } from '../api'

function parseBatchLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const normalized = line.replace(/,/g, ',')
      const commaIndex = normalized.indexOf(',')
      if (commaIndex < 0) {
        return { username: normalized.trim(), password: '' }
      }
      return {
        username: normalized.slice(0, commaIndex).trim(),
        password: normalized.slice(commaIndex + 1).trim()
      }
    })
}

function toBatchCopyText(batchResult) {
  if (!batchResult?.results?.length) return ''
  return batchResult.results.map((row) => {
    const username = row.username || '(空)'
    if (row.success) {
      return `第 ${row.index} 行\t${username}\t成功\t用户 ID: ${row.userId}`
    }
    return `第 ${row.index} 行\t${username}\t失败\t原因: ${toFriendlyError(row.reason || '未知错误')}`
  }).join('\n')
}

export default function useSystemActions({
  selectedSpaceId,
  ensureCanManageSpace,
  registrationEnabled,
  setRegistrationEnabled,
  refreshSpaces,
  setError,
  normalizeLanguage,
  systemState,
  passwordState,
  batchState,
  modalState
}) {
  const createSpace = async () => {
    if (!systemState.newSpaceName.trim()) {
      setError('空间名称不能为空')
      return
    }
    try {
      setError('')
      await api.createSpace({
        name: systemState.newSpaceName.trim(),
        description: systemState.newSpaceDesc.trim(),
        defaultProgrammingLanguage: 'cpp'
      })
      systemState.setNewSpaceName('')
      systemState.setNewSpaceDesc('')
      await refreshSpaces()
      modalState.closeConfigModal()
    } catch (err) {
      setError(err.message)
    }
  }

  const updateSpaceSettings = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!systemState.spaceSettingsName.trim()) {
      setError('空间名称不能为空')
      return
    }
    try {
      setError('')
      systemState.setSpaceSettingsMessage('')
      systemState.setSpaceSettingsSubmitting(true)
      await api.updateSpace(selectedSpaceId, {
        name: systemState.spaceSettingsName.trim(),
        description: systemState.spaceSettingsDescription.trim(),
        defaultProgrammingLanguage: normalizeLanguage(systemState.spaceDefaultLanguage)
      })
      systemState.setSpaceSettingsMessage('空间设置已保存')
      await refreshSpaces()
      modalState.closeConfigModal()
    } catch (err) {
      setError(err.message)
    } finally {
      systemState.setSpaceSettingsSubmitting(false)
    }
  }

  const toggleRegistration = async () => {
    try {
      setError('')
      const next = !registrationEnabled
      await api.setRegistration(next)
      setRegistrationEnabled(next)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAdminResetPassword = async () => {
    const userId = Number(systemState.adminResetUserId)
    if (!Number.isInteger(userId) || userId <= 0) {
      setError('请输入有效的用户ID')
      return
    }
    try {
      setError('')
      systemState.setAdminResetMessage('')
      systemState.setAdminResetSubmitting(true)
      await api.adminResetUserPassword(userId)
      systemState.setAdminResetUserId('')
      systemState.setAdminResetMessage(`用户 #${userId} 的密码已重置为 123456`)
      modalState.closeConfigModal()
    } catch (err) {
      setError(err.message)
    } finally {
      systemState.setAdminResetSubmitting(false)
    }
  }

  const handleChangePassword = async () => {
    if (!passwordState.oldPassword || !passwordState.newPassword) {
      setError('请输入旧密码和新密码')
      return
    }
    if (passwordState.newPassword.length < 6) {
      setError('新密码至少 6 位')
      return
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }
    try {
      setError('')
      passwordState.setChangePasswordMessage('')
      passwordState.setChangePasswordSubmitting(true)
      await api.changePassword({ oldPassword: passwordState.oldPassword, newPassword: passwordState.newPassword })
      passwordState.setOldPassword('')
      passwordState.setNewPassword('')
      passwordState.setConfirmPassword('')
      passwordState.setChangePasswordMessage('密码修改成功')
    } catch (err) {
      setError(err.message)
    } finally {
      passwordState.setChangePasswordSubmitting(false)
    }
  }

  const handleBatchRegister = async () => {
    const items = parseBatchLines(batchState.batchInput)
    if (items.length === 0) {
      setError('请输入批量账号，格式为每行：用户名，密码')
      return
    }

    const payload = { items }
    if (batchState.batchSpaceId) {
      payload.spaceId = Number(batchState.batchSpaceId)
    }

    try {
      setError('')
      batchState.setBatchSubmitting(true)
      const result = await api.batchRegisterUsers(payload)
      batchState.setBatchResult(result)
      modalState.closeConfigModal()
    } catch (err) {
      setError(err.message)
    } finally {
      batchState.setBatchSubmitting(false)
    }
  }

  const copyBatchResult = async () => {
    const text = toBatchCopyText(batchState.batchResult)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setError('')
    } catch {
      setError('复制失败，请手动复制结果内容')
    }
  }

  return {
    createSpace,
    updateSpaceSettings,
    toggleRegistration,
    handleAdminResetPassword,
    handleChangePassword,
    handleBatchRegister,
    copyBatchResult
  }
}
