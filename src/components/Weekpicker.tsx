import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useState } from 'react'

interface WeekPickerProps {
  value: string
  onChange: (date: string) => void
}

export function WeekPicker({ value, onChange }: WeekPickerProps) {
  const [open, setOpen] = useState(false)
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })

  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: weekEnd
  })

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Crear fecha en zona horaria local sin conversión UTC
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')

      // Enviar como string sin conversión de timezone
      onChange(`${year}-${month}-${day}`)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          {value ?
            // Parsear la fecha como local, no UTC
            format(new Date(value.split('-').map(Number).join('/')), "EEEE, d 'de' MMMM", { locale: es }) :
            <span>Selecciona un día de esta semana</span>
          }
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ? new Date(value.split('-').map(Number).join('/')) : undefined}
          onSelect={handleSelect}
          disabled={(date) => {
            return !weekDays.some(weekDay => isSameDay(date, weekDay))
          }}
          initialFocus
          fromDate={weekStart}
          toDate={weekEnd}
        />
      </PopoverContent>
    </Popover>
  )
}
