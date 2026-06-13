import { useState, useRef, useEffect } from 'react'
import { Input } from './input'
import { Badge } from './badge'
import { X } from 'lucide-react'

function parseTagInput(raw) {
  return String(raw || '')
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function TagInput({ tags = [], onChange, placeholder = '输入标签后按回车', suggestions = [] }) {
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const mergePending = (raw = inputValue) => {
    const parsed = parseTagInput(raw)
    if (parsed.length === 0) return
    const next = [...new Set([...tags, ...parsed])]
    if (next.length !== tags.length || next.some((t, i) => t !== tags[i])) {
      onChange(next)
    }
    setInputValue('')
  }

  const removeTag = (tag) => onChange(tags.filter((t) => t !== tag))

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      mergePending()
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  useEffect(() => {
    if (inputValue) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }, [inputValue])

  const filteredSuggestions = suggestions.filter((s) => !tags.includes(s))

  // Clicking outside the input area should not commit pending text automatically
  // to avoid committing partial input; we only commit on Enter or blur

  return (
    <div className="space-y-1.5">
      <div
        className="flex flex-wrap gap-1.5 rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent min-h-[2.5rem] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[11px] gap-1 shrink-0">
            {tag}
            <X
              className="h-3 w-3 cursor-pointer hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
            />
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[80px] border-none bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          placeholder={tags.length === 0 ? placeholder : ''}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => mergePending()}
        />
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filteredSuggestions.slice(0, 5).map((s) => (
            <Badge
              key={s}
              variant="outline"
              className="cursor-pointer hover:bg-accent text-[11px]"
              onMouseDown={(e) => { e.preventDefault(); onChange([...tags, s]); setInputValue('') }}
            >
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
