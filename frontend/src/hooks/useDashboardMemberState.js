import { useCallback, useState } from 'react'

export default function useDashboardMemberState() {
  const [memberRole, setMemberRole] = useState('member')
  const [memberCandidateInput, setMemberCandidateInput] = useState('')
  const [selectedMemberCandidates, setSelectedMemberCandidates] = useState([])
  const [memberSubmitting, setMemberSubmitting] = useState(false)
  const [memberMessage, setMemberMessage] = useState('')
  const [resettingMemberId, setResettingMemberId] = useState(null)
  const [removingMemberId, setRemovingMemberId] = useState(null)

  const resetMemberState = useCallback(() => {
    setMemberRole('member')
    setMemberCandidateInput('')
    setSelectedMemberCandidates([])
    setMemberSubmitting(false)
    setMemberMessage('')
    setResettingMemberId(null)
    setRemovingMemberId(null)
  }, [])

  return {
    memberRole,
    setMemberRole,
    memberCandidateInput,
    setMemberCandidateInput,
    selectedMemberCandidates,
    setSelectedMemberCandidates,
    memberSubmitting,
    setMemberSubmitting,
    memberMessage,
    setMemberMessage,
    resettingMemberId,
    setResettingMemberId,
    removingMemberId,
    setRemovingMemberId,
    resetMemberState
  }
}
