import { format, isAfter, startOfDay, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
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

  const parseValueToDate = (dateStr: string): Date | undefined => {
    if (!dateStr) return undefined
    const [year, month, day] = dateStr.split('-').map(Number)
    if (isNaN(year) || isNaN(month) || isNaN(day)) return undefined
    const date = new Date(year, month - 1, day)
    return isValid(date) ? date : undefined
  }

  const selectedDate = parseValueToDate(value)

  const formatDateDisplay = (date: Date): string => {
    const currentYear = new Date().getFullYear()
    const pattern = date.getFullYear() === currentYear
      ? "EEEE, d 'de' MMMM"
      : "EEEE, d 'de' MMMM 'de' yyyy"

    const formatted = format(date, pattern, { locale: es })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      // Crear fecha en formato YYYY-MM-DD en zona horaria local
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')

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
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate ? (
            formatDateDisplay(selectedDate)
          ) : (
            <span>Selecciona una fecha</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(date) => isAfter(startOfDay(date), startOfDay(new Date()))}
          toDate={new Date()}
          defaultMonth={selectedDate || new Date()}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export const DatePicker = WeekPicker
