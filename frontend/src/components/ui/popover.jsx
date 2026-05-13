import * as React from "react"
import { cn } from "../../lib/utils"
import * as PopoverPrimitive from "@radix-ui/react-popover"

function Popover({ ...props }) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

const PopoverTrigger = React.forwardRef(({ ...props }, ref) => (
  <PopoverPrimitive.Trigger ref={ref} data-slot="popover-trigger" {...props} />
))
PopoverTrigger.displayName = PopoverPrimitive.Trigger.displayName

const PopoverContent = React.forwardRef(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      data-slot="popover-content"
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-lg border-2 border-border bg-popover p-4 text-popover-foreground shadow-xl outline-none",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
