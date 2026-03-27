import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import { IconLoader } from './Icons'

/**
 * 现代化按钮组件 - 基于 MUI
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'ghost' | 'danger' | 'success'} props.variant - 按钮变体
 * @param {'sm' | 'md' | 'lg'} props.size - 按钮尺寸
 * @param {boolean} props.loading - 加载状态
 * @param {boolean} props.disabled - 禁用状态
 * @param {React.ReactNode} props.children - 按钮内容
 * @param {Function} props.onClick - 点击事件
 */
export default function ButtonWrapper({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  onClick,
  className = '',
  ...props
}) {
  const muiVariant = {
    primary: 'contained',
    secondary: 'outlined',
    ghost: 'text',
    danger: 'contained',
    success: 'contained'
  }[variant];

  const muiSize = {
    sm: 'small',
    md: 'medium',
    lg: 'large'
  }[size];

  const muiColor = {
    primary: 'primary',
    secondary: 'secondary',
    ghost: 'inherit',
    danger: 'error',
    success: 'success'
  }[variant];

  return (
    <Button
      variant={muiVariant}
      size={muiSize}
      color={muiColor}
      disabled={disabled || loading}
      onClick={onClick}
      className={className}
      startIcon={loading ? <CircularProgress size={16} sx={{ color: 'currentColor' }} /> : undefined}
      {...props}
    >
      {children}
    </Button>
  );
}
