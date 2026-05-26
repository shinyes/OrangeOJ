import { Link } from 'react-router-dom'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { Label } from '../ui/label'
import { X, Loader2 } from 'lucide-react'
import ToastMessage from '../ToastMessage'

function SummaryItem({ label, value }) {
  return (
    <Card>
      <CardContent className="p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <p className="text-base font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}

function ProblemRow({ text, actions }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <div className="flex flex-col md:flex-row gap-2 justify-between items-start md:items-center">
          <span className="text-sm font-medium truncate flex-1 min-w-0" title={text}>{text}</span>
          <div className="flex gap-2 flex-wrap">{actions}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function MemberComboBox({ candidates, selectedUsers, inputValue, loading, onInputChange, onSelectionChange, getCandidateLabel }) {
  const handleSelect = (user) => {
    if (selectedUsers.some((u) => u.id === user.id)) {
      onSelectionChange(selectedUsers.filter((u) => u.id !== user.id))
    } else {
      onSelectionChange([...selectedUsers, user])
    }
  }

  return (
    <div className="space-y-2 mt-3">
      <Input placeholder="输入用户 ID 或用户名搜索" value={inputValue}
        onChange={(e) => onInputChange(e.target.value)} />
      {loading && <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />搜索中...</p>}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((user) => (
            <Badge key={user.id} variant="secondary" className="gap-1 cursor-pointer" onClick={() => handleSelect(user)}>
              {getCandidateLabel(user)}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
      {candidates.length > 0 && (
        <div className="border rounded-lg max-h-48 overflow-y-auto">
          {candidates.map((user) => (
            <div key={user.id} className="px-3 py-2 text-sm cursor-pointer hover:bg-accent" onClick={() => handleSelect(user)}>
              {getCandidateLabel(user)}
            </div>
          ))}
        </div>
      )}
      {!loading && !inputValue.trim() && candidates.length === 0 && (
        <p className="text-xs text-muted-foreground">输入用户 ID 或用户名开始搜索</p>
      )}
      {!loading && inputValue.trim() && candidates.length === 0 && (
        <p className="text-xs text-muted-foreground">没有匹配用户</p>
      )}
    </div>
  )
}

export default function SpaceManagePanel({
  hasAnySpaceAdminRole, selectedSpace, canManageSelectedSpace, spaceManageTab, onSpaceManageTabChange,
  normalizeLanguage, openSpaceSettingsModal, spaceSettingsMessage,
  spaceProblemSearch, onSpaceProblemSearchChange, filteredSpaceProblems, spaceProblems, problemTypeText,
  editingProblemId, onOpenEditProblem, onExportSpaceProblem, onRemoveSpaceProblem,
  spaceMembers, memberRole, onMemberRoleChange, memberCandidateInput, onMemberCandidateInputChange,
  memberCandidates, selectedMemberCandidates, onSelectedMemberCandidatesChange, memberSearchLoading,
  onSubmitMembers, memberSubmitting, onResetMemberPassword, resettingMemberId, onRemoveMember, removingMemberId,
  memberMessage, openUploadProblemModal, selectedSpaceId
}) {
  const renderMemberLabel = (member) => {
    if (!member) return ''
    const parts = [`#${member.userId || member.id}`, member.username]
    if (member.globalRole === 'system_admin') parts.push('系统管理员')
    parts.push(member.role === 'space_admin' ? '空间管理员' : '成员')
    return parts.join(' · ')
  }

  const getCandidateLabel = (candidate) => {
    if (!candidate) return ''
    const parts = [`#${candidate.id}`, candidate.username]
    if (candidate.globalRole === 'system_admin') parts.push('系统管理员')
    return parts.join(' · ')
  }

  if (!hasAnySpaceAdminRole) {
    return (
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-bold mb-2">空间管理</h2>
          <p className="text-muted-foreground">当前账号只能浏览空间，不能修改空间设置、题库或成员。</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      {!selectedSpace && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-bold mb-2">还没有选中空间</h3>
            <p className="text-muted-foreground">从上方选择空间后，这里才会显示对应的管理内容。</p>
          </CardContent>
        </Card>
      )}

      {!canManageSelectedSpace && selectedSpace && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h3 className="text-base font-bold mt-4">已选空间：#{selectedSpace.id} {selectedSpace.name}</h3>
            <p className="text-muted-foreground mt-1">你当前只能查看这个空间，不能修改其设置、题库或成员。</p>
          </CardContent>
        </Card>
      )}

      {selectedSpace && canManageSelectedSpace && (
        <div>
          <Card className="mb-6">
            <Tabs value={spaceManageTab} onValueChange={onSpaceManageTabChange}>
              <TabsList className="w-full">
                <TabsTrigger value="settings" className="flex-1">空间设置</TabsTrigger>
                <TabsTrigger value="problems" className="flex-1">题库设置</TabsTrigger>
                <TabsTrigger value="members" className="flex-1">成员管理</TabsTrigger>
              </TabsList>
            </Tabs>
          </Card>

          {/* Settings Tab */}
          {spaceManageTab === 'settings' && (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
                  <div>
                    <h2 className="text-lg font-bold">空间设置</h2>
                    <p className="text-sm text-muted-foreground mt-1">#{selectedSpace.id} {selectedSpace.name} 的基础信息和默认语言。</p>
                  </div>
                  <Button onClick={openSpaceSettingsModal}>编辑空间设置</Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <SummaryItem label="空间名称" value={selectedSpace.name || '-'} />
                  <SummaryItem label="默认语言" value={normalizeLanguage(selectedSpace.defaultProgrammingLanguage || 'cpp')} />
                  <SummaryItem label="空间题目数" value={spaceProblems.length} />
                </div>

                <Card className="mt-4">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold mb-1">空间描述</h3>
                    <p className="text-sm text-muted-foreground">{selectedSpace.description || '暂无描述'}</p>
                  </CardContent>
                </Card>

                {spaceSettingsMessage && <div className="mt-4"><ToastMessage message={spaceSettingsMessage} severity="success" /></div>}
              </CardContent>
            </Card>
          )}

          {/* Problems Tab */}
          {spaceManageTab === 'problems' && (
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-3 justify-between items-start md:items-center">
                  <div>
                    <h2 className="text-lg font-bold">当前空间题库</h2>
                    <p className="text-sm text-muted-foreground mt-1">题目只属于当前空间，仅管理当前空间题目。</p>
                  </div>
                  <Button onClick={openUploadProblemModal}>新建题目</Button>
                </div>

                <Input className="mt-4" placeholder="按题目 ID、标题或标签搜索" value={spaceProblemSearch}
                  onChange={(e) => onSpaceProblemSearchChange(e.target.value)} />

                <div className="mt-4 max-h-[55vh] overflow-auto">
                  <div className="flex flex-col gap-2 pr-3">
                    {filteredSpaceProblems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {spaceProblems.length === 0 ? '当前空间暂无题目。' : '当前检索条件下没有匹配题目。'}
                      </p>
                    ) : (
                      filteredSpaceProblems.map((problem) => {
                        const tagsText = (problem.tags || []).join(' / ')
                        const lineText = [`#${problem.id}`, problem.title, problemTypeText(problem.type), problem.type === 'programming' && `${problem.timeLimitMs}ms`, problem.type === 'programming' && `${problem.memoryLimitMiB}MiB`, tagsText].filter(Boolean).join(' · ')
                        return (
                          <ProblemRow key={problem.id} text={lineText} actions={(
                            <>
                              <Button size="sm" variant="outline" asChild>
                                <Link to={`/spaces/${selectedSpaceId}/problems/${problem.id}/solve`}>去做题</Link>
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => onOpenEditProblem(problem.id)}>编辑</Button>
                              <Button size="sm" variant="outline" onClick={() => onExportSpaceProblem(problem.id)}>导出</Button>
                              <Button size="sm" variant="destructive" onClick={() => onRemoveSpaceProblem(problem.id)}>删除</Button>
                            </>
                          )} />
                        )
                      })
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Members Tab */}
          {spaceManageTab === 'members' && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] gap-6">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold">添加成员</h2>
                  <p className="text-sm text-muted-foreground mt-1">按用户 ID 或用户名搜索，选中后加入当前空间。</p>

                  <Label className="flex flex-col gap-2 mt-4">
                    加入后角色
                    <Select value={memberRole} onValueChange={onMemberRoleChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">成员</SelectItem>
                        <SelectItem value="space_admin">空间管理员</SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>

                  <MemberComboBox
                    candidates={memberCandidates}
                    selectedUsers={selectedMemberCandidates}
                    inputValue={memberCandidateInput}
                    loading={memberSearchLoading}
                    onInputChange={onMemberCandidateInputChange}
                    onSelectionChange={onSelectedMemberCandidatesChange}
                    getCandidateLabel={getCandidateLabel}
                  />

                  <Button className="mt-4" onClick={onSubmitMembers}
                    disabled={memberSubmitting || selectedMemberCandidates.length === 0}>
                    {memberSubmitting ? '添加中...' : `添加所选用户${selectedMemberCandidates.length > 0 ? `（${selectedMemberCandidates.length}）` : ''}`}
                  </Button>

                  {memberMessage && <div className="mt-4"><ToastMessage message={memberMessage} severity="success" /></div>}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold">当前空间成员</h2>
                  <p className="text-sm text-muted-foreground mt-1">当前共有 {spaceMembers.length} 名成员。可直接重置密码或移出空间。</p>

                  <div className="mt-4 max-h-[55vh] overflow-auto">
                    <div className="flex flex-col gap-2 pr-3">
                      {spaceMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">当前空间还没有成员。</p>
                      ) : (
                        spaceMembers.map((member) => (
                          <ProblemRow key={member.userId} text={renderMemberLabel(member)} actions={(
                            <>
                              <Button size="sm" variant="outline" disabled={resettingMemberId === member.userId}
                                onClick={() => onResetMemberPassword(member)}>
                                {resettingMemberId === member.userId ? '重置中...' : '重置密码'}
                              </Button>
                              <Button size="sm" variant="destructive" disabled={removingMemberId === member.userId}
                                onClick={() => onRemoveMember(member)}>
                                {removingMemberId === member.userId ? '移除中...' : '移除'}
                              </Button>
                            </>
                          )} />
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
