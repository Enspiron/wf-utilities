"use client"

import * as React from "react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type Locale,
} from "react-day-picker"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  locale,
  formatters,
  components,
  ...props
}: CalendarProps) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("relative", className)}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code, { month: "short" }),
        ...formatters,
      }}
      classNames={{
        [defaultClassNames.month]: "w-full space-y-4",
        [defaultClassNames.month_grid]: "w-full border-collapse",
        [defaultClassNames.weekdays]: "flex",
        [defaultClassNames.weekday]:
          "flex-1 min-w-0 text-muted-foreground rounded-sm w-8 font-normal text-[0.8rem]",
        [defaultClassNames.weeks]: "w-full space-y-2",
        [defaultClassNames.week]: "flex w-full mt-2",
        [defaultClassNames.day]: cn(
          "group relative flex-1 min-w-0 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([data-selected=true])]:bg-accent [&:has([data-selected=true])]:rounded-[--cell-radius] [&:has([data-today=true])]:bg-accent/50",
          "[&:last-child[data-selected=true]_button]:rounded-e-[--cell-radius] [&:nth-child(2)[data-selected=true]_button]:rounded-s-[--cell-radius] [&:first-child[data-selected=true]_button]:rounded-s-[--cell-radius]",
          "first:[&:has([data-selected=true])]:rounded-s-[--cell-radius] last:[&:has([data-selected=true])]:rounded-e-[--cell-radius]"
        ),
        [defaultClassNames.day_button]: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-8 w-8 p-0 font-normal data-[selected=true]:opacity-100 data-[outside=true]:pointer-events-none data-[outside=true]:text-muted-foreground data-[outside=true]:opacity-50 data-[disabled=true]:text-muted-foreground data-[disabled=true]:opacity-50 data-[range-end=true]:rounded-e-[--cell-radius] data-[range-start=true]:rounded-s-[--cell-radius] data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:hover:bg-primary data-[selected=true]:hover:text-primary-foreground data-[selected=true]:focus:bg-primary data-[selected=true]:focus:text-primary-foreground data-[today=true]:bg-accent data-[today=true]:text-accent-foreground"
        ),
        [defaultClassNames.range_start]: "day-range-start rounded-s-[--cell-radius] data-[selected=true]:rounded-s-[--cell-radius] after:absolute after:inset-y-0 after:end-0 after:w-1/2 after:bg-accent after:-z-10",
        [defaultClassNames.range_end]: "day-range-end rounded-e-[--cell-radius] data-[selected=true]:rounded-e-[--cell-radius] after:absolute after:inset-y-0 after:start-0 after:w-1/2 after:bg-accent after:-z-10",
        [defaultClassNames.range_middle]:
          "data-[selected=true]:rounded-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        [defaultClassNames.hidden]: "invisible",
        [defaultClassNames.chevron]: "size-4",
        [defaultClassNames.outside]: "day-outside",
        [defaultClassNames.disabled]: "text-muted-foreground opacity-50",
        [defaultClassNames.selected]: "bg-primary text-primary-foreground",
        [defaultClassNames.today]: "bg-accent text-accent-foreground",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight
          return <Icon className="h-4 w-4" />
        },
        DayButton: ({ ...props }) => (
          <CalendarDayButton locale={locale} {...props} />
        ),
        ...components,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

function CalendarDayButton({
  className,
  day,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code)}
      className={className}
      {...props}
    />
  )
}

export { Calendar }
