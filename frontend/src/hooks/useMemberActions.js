import { api } from '../api'

export default function useMemberActions({
  selectedSpaceId,
  ensureCanManageSpace,
  setError,
  refreshSpaces,
  refreshSpaceMemberData,
  memberState
}) {
  const handleAddMembers = async () => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (memberState.memberRole !== 'member' && memberState.memberRole !== 'space_admin') {
      setError('请选择有效角色')
      return
    }
    if (memberState.selectedMemberCandidates.length === 0) {
      setError('请先搜索并选择要添加的用户')
      return
    }

    try {
      setError('')
      memberState.setMemberMessage('')
      memberState.setMemberSubmitting(true)
      await Promise.all(memberState.selectedMemberCandidates.map((candidate) => api.addSpaceMember(selectedSpaceId, candidate.id, memberState.memberRole)))
      memberState.setSelectedMemberCandidates([])
      memberState.setMemberCandidateInput('')
      memberState.setMemberCandidates([])
      memberState.setMemberMessage(`已添加 ${memberState.selectedMemberCandidates.length} 名用户，角色：${memberState.memberRole === 'space_admin' ? '空间管理员' : '成员'}`)
      await refreshSpaces()
      try {
        await refreshSpaceMemberData(selectedSpaceId)
      } catch {}
    } catch (err) {
      setError(err.message)
    } finally {
      memberState.setMemberSubmitting(false)
    }
  }

  const handleResetSpaceMemberPassword = async (member) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!member?.userId) return

    try {
      setError('')
      memberState.setMemberMessage('')
      memberState.setResettingMemberId(member.userId)
      await api.resetSpaceMemberPassword(selectedSpaceId, member.userId)
      memberState.setMemberMessage(`用户 #${member.userId} 的密码已重置为 123456`)
    } catch (err) {
      setError(err.message)
    } finally {
      memberState.setResettingMemberId(null)
    }
  }

  const handleRemoveSpaceMember = async (member) => {
    if (!selectedSpaceId) return
    if (!ensureCanManageSpace()) return
    if (!member?.userId) return

    const confirmed = window.confirm(`确认将用户 #${member.userId} ${member.username || ''} 移出当前空间？`)
    if (!confirmed) return

    try {
      setError('')
      memberState.setMemberMessage('')
      memberState.setRemovingMemberId(member.userId)
      await api.deleteSpaceMember(selectedSpaceId, member.userId)
      memberState.setMemberMessage(`已将用户 #${member.userId} 移出当前空间`)
      await refreshSpaces()
      try {
        await refreshSpaceMemberData(selectedSpaceId)
      } catch {}
    } catch (err) {
      setError(err.message)
    } finally {
      memberState.setRemovingMemberId(null)
    }
  }

  return {
    handleAddMembers,
    handleResetSpaceMemberPassword,
    handleRemoveSpaceMember
  }
}
