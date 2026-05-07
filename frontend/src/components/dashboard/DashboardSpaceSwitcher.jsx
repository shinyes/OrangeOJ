import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'

export default function DashboardSpaceSwitcher({
  spaces,
  selectedSpaceId,
  onSpaceChange,
  isSystemAdmin,
  hasAnySpaceAdminRole,
  mode = 'learn',
  showManageButton = true,
  showCreateButton = false,
  onManage,
  onCreateSpace
}) {
  const availableSpaces = mode === 'manage'
    ? (isSystemAdmin ? spaces : spaces.filter((space) => space.myRole === 'space_admin'))
    : spaces

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {showManageButton && hasAnySpaceAdminRole && mode !== 'manage' && (
        <Button
          size="small"
          variant="outlined"
          onClick={onManage}
          sx={{ minWidth: 'auto' }}
        >
          管理
        </Button>
      )}
      <FormControl size="small" sx={{ minWidth: 160 }} disabled={availableSpaces.length === 0}>
        <InputLabel id={`space-select-label-${mode}`}>空间</InputLabel>
        <Select
          labelId={`space-select-label-${mode}`}
          value={selectedSpaceId || ''}
          label="空间"
          onChange={(event) => onSpaceChange(Number(event.target.value))}
          sx={{
            bgcolor: 'background.paper',
            borderRadius: 1,
            overflow: 'hidden',
            '& .MuiOutlinedInput-notchedOutline': {
              borderRadius: 1
            }
          }}
        >
          {availableSpaces.length === 0 && (
            <MenuItem value="" disabled>
              {mode === 'manage' ? '暂无可管理空间' : '暂无空间'}
            </MenuItem>
          )}
          {availableSpaces.map((space) => (
            <MenuItem key={space.id} value={space.id}>
              {space.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {showCreateButton && isSystemAdmin && (
        <Button
          size="small"
          variant="outlined"
          onClick={onCreateSpace}
          sx={{ minWidth: 'auto' }}
        >
          新建空间
        </Button>
      )}
    </Box>
  )
}
