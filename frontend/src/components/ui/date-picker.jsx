import * as React from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Input } from "./input"

function DatePicker({ value, onChange, placeholder = "选择日期" }) {
  const [open, setOpen] = React.useState(false)
  const date = value ? new Date(value) : undefined
  const valid = date && !isNaN(date.getTime())

  const handleSelect = (day) => {
    if (!day) return
    const prev = valid ? new Date(date) : new Date()
    const next = new Date(day)
    next.setHours(prev.getHours(), prev.getMinutes(), 0, 0)
    onChange(format(next, "yyyy-MM-dd'T'HH:mm"))
    setOpen(false)
  }

  const handleTimeChange = (e) => {
    const time = e.target.value
    if (!time) return
    const [h, m] = time.split(":").map(Number)
    const base = valid ? new Date(date) : new Date()
    base.setHours(h, m, 0, 0)
    onChange(format(base, "yyyy-MM-dd'T'HH:mm"))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !valid && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {valid ? format(date, "yyyy-MM-dd HH:mm") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DayPicker
          mode="single"
          selected={valid ? date : undefined}
          onSelect={handleSelect}
          locale={zhCN}
          className="p-3"
          classNames={{
            months: "flex flex-col gap-4",
            month: "flex flex-col gap-4",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            nav: "flex items-center gap-1",
            nav_button: cn(
              "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 border rounded-md"
            ),
            table: "w-full border-collapse space-y-1",
            head_row: "flex",
            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
            row: "flex w-full mt-2",
            cell: cn(
              "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
              "[&:has([aria-selected])]:bg-accent [&:has([aria-selected])]:rounded-md"
            ),
            day: cn(
              "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md",
              "hover:bg-accent hover:text-accent-foreground"
            ),
            day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            day_today: "bg-accent text-accent-foreground",
            day_outside: "text-muted-foreground opacity-50",
          }}
        />
        <div className="p-3 pt-0 border-t">
          <Input
            type="time"
            value={valid ? format(date, "HH:mm") : ""}
            onChange={handleTimeChange}
            className="mt-2"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

DatePicker.displayName = "DatePicker"

export { DatePicker }
