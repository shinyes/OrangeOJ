import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import { styled } from '@mui/material/styles'

const StyledCard = styled(Card)(({ theme, clickable }) => ({
  cursor: clickable ? 'pointer' : 'auto',
  transition: theme.transitions.create(['transform', 'box-shadow'], {
    duration: theme.transitions.duration.shortest,
  }),
  ...(clickable && {
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: theme.shadows[8],
    },
  }),
}))

/**
 * 现代化卡片组件 - 基于 MUI
 * @param {Object} props
 * @param {React.ReactNode} props.children - 卡片内容
 * @param {string} props.title - 卡片标题
 * @param {string} props.className - 额外类名
 * @param {boolean} props.clickable - 是否可点击
 * @param {Function} props.onClick - 点击事件
 */
export default function CardWrapper({
  children,
  title,
  className = '',
  clickable = false,
  onClick,
  ...props
}) {
  return (
    <StyledCard 
      className={className}
      clickable={clickable}
      onClick={clickable ? onClick : undefined}
      {...props}
    >
      {title && (
        <CardHeader title={title} />
      )}
      <CardContent>
        {children}
      </CardContent>
    </StyledCard>
  );
}
