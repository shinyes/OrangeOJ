import * as React from "react"
import { cn } from "../../lib/utils"

const Alert = React.forwardRef(({ className, variant, ...props }, ref) => {
  const variants = {
    default: "bg-background text-foreground",
    destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
    success: "border-green-500/50 text-green-700 dark:border-green-500 [&>svg]:text-green-600",
    warning: "border-yellow-500/50 text-yellow-700 dark:border-yellow-500 [&>svg]:text-yellow-600",
    info: "border-blue-500/50 text-blue-700 dark:border-blue-500 [&>svg]:text-blue-600",
  }

  return (
    <div
      ref={ref}
      data-slot="alert"
      role="alert"
      className={cn(
        "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  )
})
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h5 ref={ref} data-slot="alert-title" className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="alert-description" className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
