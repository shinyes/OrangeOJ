import * as React from "react"
import { cn } from "../../lib/utils"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import { buttonVariants } from "./button"

function AlertDialog({ ...props }) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

const AlertDialogTrigger = React.forwardRef(({ ...props }, ref) => (
  <AlertDialogPrimitive.Trigger ref={ref} data-slot="alert-dialog-trigger" {...props} />
))
AlertDialogTrigger.displayName = AlertDialogPrimitive.Trigger.displayName

const AlertDialogContent = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60" />
    <AlertDialogPrimitive.Content
      ref={ref}
      data-slot="alert-dialog-content"
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border-2 bg-background p-6 shadow-xl rounded-lg",
        className
      )}
      {...props}
    />
  </AlertDialogPrimitive.Portal>
))
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

function AlertDialogHeader({ className, ...props }) {
  return <div data-slot="alert-dialog-header" className={cn("flex flex-col gap-1.5 text-center sm:text-left", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }) {
  return <div data-slot="alert-dialog-footer" className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2", className)} {...props} />
}

const AlertDialogTitle = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} data-slot="alert-dialog-title" className={cn("text-lg font-semibold", className)} {...props} />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} data-slot="alert-dialog-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
))
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel ref={ref} className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)} {...props} />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
