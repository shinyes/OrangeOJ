import * as React from "react"
import { cn } from "../../lib/utils"

const Badge = React.forwardRef(({ className, variant, ...props }, ref) => {
  const variants = {
    default: "bg-primary text-primary-foreground hover:brightness-90",
    secondary: "bg-secondary text-secondary-foreground hover:brightness-90",
    destructive: "bg-destructive text-destructive-foreground hover:brightness-90",
    outline: "text-foreground border hover:bg-accent hover:text-accent-foreground",
    success: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200",
    info: "bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-200",
  }

  return (
    <div
      ref={ref}
      data-slot="badge"
      className={cn(
        "inline-flex items-center rounded-md border border-transparent px-2 py-0.5 text-xs font-medium transition-colors",
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge }
