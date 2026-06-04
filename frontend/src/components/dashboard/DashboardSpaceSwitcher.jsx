import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'

export default function DashboardSpaceSwitcher({
  spaces, selectedSpaceId, onSpaceChange, isSystemAdmin, hasAnySpaceAdminRole,
  mode = 'learn', showManageButton = true, showCreateButton = false,
  onManage, onCreateSpace
}) {
  const availableSpaces = mode === 'manage'
    ? (isSystemAdmin ? spaces : spaces.filter((space) => space.myRole === 'space_admin'))
    : spaces

  return (
    <div className="flex items-center gap-2">
      {showManageButton && hasAnySpaceAdminRole && mode !== 'manage' && (
        <Button size="sm" variant="outline" onClick={onManage}>管理</Button>
      )}
      <Select
        value={selectedSpaceId ? String(selectedSpaceId) : ''}
        onValueChange={(v) => onSpaceChange(Number(v))}
        disabled={availableSpaces.length === 0}
      >
        <SelectTrigger className="w-[140px] sm:w-[160px] h-8">
          <SelectValue placeholder="空间" />
        </SelectTrigger>
        <SelectContent>
          {availableSpaces.map((space) => (
            <SelectItem key={space.id} value={String(space.id)}>{space.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showCreateButton && isSystemAdmin && (
        <Button size="sm" variant="outline" onClick={onCreateSpace}>新建空间</Button>
      )}
    </div>
  )
}
