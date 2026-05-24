import { useMemo } from 'react'
import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import { cn } from '../lib/utils'
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

function renderMarkdown(content) {
  const source = String(content || '').replace(/\\n/g, '\n').trim()
  if (!source) return ''
  const html = markdownRenderer.parse(source)
  return DOMPurify.sanitize(typeof html === 'string' ? html : '', {
    USE_PROFILES: { html: true, svg: true, mathMl: true }
  })
}

export default function MarkdownContent({ content = '', className, ...props }) {
  const html = useMemo(() => renderMarkdown(content), [content])

  if (!html) return null

  return (
    <div
      {...props}
      className={cn(
        'min-w-0 text-foreground leading-relaxed break-words',
        '[&>:first-child]:mt-0 [&>:last-child]:mb-0',
        '[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight',
        '[&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-tight',
        '[&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-tight',
        '[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-base [&_h4]:font-semibold',
        '[&_p]:my-3',
        '[&_ul]:my-3 [&_ul]:pl-8 [&_ul]:list-disc',
        '[&_ol]:my-3 [&_ol]:pl-8 [&_ol]:list-decimal',
        '[&_li+li]:mt-1.5',
        '[&_blockquote]:my-4 [&_blockquote]:mx-0 [&_blockquote]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:text-muted-foreground',
        '[&_pre]:my-4 [&_pre]:p-4 [&_pre]:block [&_pre]:w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:border [&_pre]:border-border [&_pre]:text-sm [&_pre]:leading-relaxed [&_pre]:whitespace-pre-wrap',
        '[&_code]:font-mono [&_code]:whitespace-pre-wrap',
        '[&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:text-sm [&_:not(pre)>code]:whitespace-normal',
        '[&_pre_code]:bg-transparent [&_pre_code]:text-inherit',
        '[&_table]:w-full [&_table]:my-5 [&_table]:border-collapse',
        '[&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left',
        '[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-left',
        '[&_a]:text-primary [&_a]:underline',
        '[&_img]:max-w-full',
        '[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden',
        '[&_.katex-display>.katex]:whitespace-nowrap',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function MarkdownWithMarker({ marker, content = '', className, markerClassName, contentClassName }) {
  return (
    <div className={cn('grid gap-x-2 items-start', className)}
      style={{ gridTemplateColumns: 'max-content minmax(0, 1fr)' }}
    >
      <span className={cn(
        'shrink-0 min-w-[2.4ch] font-bold text-right tabular-nums',
        markerClassName
      )}
        style={{ lineHeight: 1.7 }}
      >
        {marker}
      </span>
      <MarkdownContent content={content} className={cn('flex-1', contentClassName)} />
    </div>
  )
}
