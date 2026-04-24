import { useMemo } from 'react'
import Box from '@mui/material/Box'
import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import 'katex/dist/katex.min.css'

const markdownRenderer = new Marked({
  async: false,
  breaks: true,
  gfm: true
})

markdownRenderer.use(markedKatex({
  throwOnError: false,
  nonStandard: true
}))

function toSxArray(sx) {
  if (!sx) return []
  return Array.isArray(sx) ? sx : [sx]
}

function renderMarkdown(content) {
  const source = String(content || '').trim()
  if (!source) return ''
  const html = markdownRenderer.parse(source)
  return DOMPurify.sanitize(typeof html === 'string' ? html : '', {
    USE_PROFILES: {
      html: true,
      svg: true,
      mathMl: true
    }
  })
}

export default function MarkdownContent({ content = '', sx, ...props }) {
  const html = useMemo(() => renderMarkdown(content), [content])

  if (!html) {
    return null
  }

  return (
    <Box
      {...props}
      sx={[
        {
          minWidth: 0,
          color: 'text.primary',
          lineHeight: 1.7,
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          '& > :first-of-type': {
            mt: 0
          },
          '& > :last-child': {
            mb: 0
          },
          '& h1, & h2, & h3, & h4, & h5, & h6': {
            mt: 1.5,
            mb: 0.75,
            fontWeight: 700,
            lineHeight: 1.35
          },
          '& h1': {
            fontSize: '1.5rem'
          },
          '& h2': {
            fontSize: '1.3rem'
          },
          '& h3': {
            fontSize: '1.15rem'
          },
          '& h4, & h5, & h6': {
            fontSize: '1rem'
          },
          '& p': {
            my: 0.75
          },
          '& ul, & ol': {
            my: 0.75,
            pl: 3
          },
          '& li + li': {
            mt: 0.4
          },
          '& blockquote': {
            my: 1,
            mx: 0,
            pl: 1.5,
            borderLeft: '4px solid',
            borderColor: 'divider',
            color: 'text.secondary'
          },
          '& pre': {
            my: 1.25,
            py: 1.25,
            px: 1.5,
            display: 'inline-block',
            width: 'fit-content',
            maxWidth: '100%',
            boxSizing: 'border-box',
            verticalAlign: 'top',
            overflowX: 'auto',
            borderRadius: 2,
            bgcolor: 'grey.100',
            color: 'text.primary',
            border: '1px solid',
            borderColor: 'divider',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            whiteSpace: 'pre',
            overflowWrap: 'normal'
          },
          '& code': {
            fontFamily: 'Consolas, "Liberation Mono", Menlo, Courier, monospace'
          },
          '& :not(pre) > code': {
            px: 0.5,
            py: 0.2,
            borderRadius: 1,
            bgcolor: 'rgba(15, 23, 42, 0.08)',
            fontSize: '0.875em'
          },
          '& pre code': {
            backgroundColor: 'transparent',
            fontSize: 'inherit'
          },
          '& table': {
            width: '100%',
            my: 1.25,
            borderCollapse: 'collapse'
          },
          '& th, & td': {
            border: '1px solid',
            borderColor: 'divider',
            px: 1,
            py: 0.75,
            textAlign: 'left',
            verticalAlign: 'top'
          },
          '& a': {
            color: 'primary.main'
          },
          '& img': {
            maxWidth: '100%'
          },
          '& .katex-display': {
            my: 1,
            overflowX: 'auto',
            overflowY: 'hidden'
          },
          '& .katex-display > .katex': {
            whiteSpace: 'nowrap'
          }
        },
        ...toSxArray(sx)
      ]}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function MarkdownWithMarker({ marker, content = '', sx, markerSx, contentSx }) {
  return (
    <Box
      sx={[
        {
          display: 'grid',
          gridTemplateColumns: 'max-content minmax(0, 1fr)',
          columnGap: 0.5,
          alignItems: 'start'
        },
        ...toSxArray(sx)
      ]}
    >
      <Box
        component="span"
        sx={[
          {
            flexShrink: 0,
            minWidth: '2.6ch',
            fontWeight: 700,
            lineHeight: 1.7,
            fontVariantNumeric: 'tabular-nums',
            textAlign: 'right'
          },
          ...toSxArray(markerSx)
        ]}
      >
        {marker}
      </Box>
      <MarkdownContent
        content={content}
        sx={[
          {
            flexGrow: 1
          },
          ...toSxArray(contentSx)
        ]}
      />
    </Box>
  )
}
