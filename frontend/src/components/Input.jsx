import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'

/**
 * 现代化输入框组件 - 基于 MUI
 * @param {Object} props
 * @param {'text' | 'password' | 'email' | 'number' | 'search'} props.type - 输入类型
 * @param {string} props.label - 标签文本
 * @param {string} props.placeholder - 占位符
 * @param {string} props.value - 值
 * @param {Function} props.onChange - 变化事件
 * @param {boolean} props.disabled - 禁用状态
 * @param {string} props.error - 错误信息
 * @param {React.ReactNode} props.leftAddon - 左侧附加内容
 * @param {React.ReactNode} props.rightAddon - 右侧附加内容
 */
export default function InputWrapper({
  type = 'text',
  label,
  placeholder,
  value,
  onChange,
  disabled = false,
  error,
  leftAddon,
  rightAddon,
  className = '',
  ...props
}) {
  return (
    <TextField
      type={type}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      error={!!error}
      helperText={error}
      fullWidth
      className={className}
      InputProps={{
        startAdornment: leftAddon ? (
          <InputAdornment position="start">{leftAddon}</InputAdornment>
        ) : undefined,
        endAdornment: rightAddon ? (
          <InputAdornment position="end">{rightAddon}</InputAdornment>
        ) : undefined,
      }}
      {...props}
    />
  );
}
