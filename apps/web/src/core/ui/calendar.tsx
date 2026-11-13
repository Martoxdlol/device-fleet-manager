import { DayPicker, type DayPickerProps } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from 'cn'
import { useLocale } from '../locale/locale-context'

const navButton =
    'inline-flex size-7 items-center justify-center text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40'

function Calendar({ className, classNames, ...props }: DayPickerProps) {
    const { calendar } = useLocale()
    return (
        <DayPicker
            locale={calendar}
            showOutsideDays
            className={cn('p-1 text-xs', className)}
            classNames={{
                root: 'relative',
                months: 'relative flex flex-col gap-4',
                month: 'flex flex-col gap-2',
                month_caption: 'flex h-7 items-center justify-center px-8',
                caption_label: 'text-xs font-medium',
                nav: 'absolute inset-x-0 top-0 flex h-7 items-center justify-between',
                button_previous: navButton,
                button_next: navButton,
                chevron: 'size-4',
                month_grid: 'w-full border-collapse',
                weekdays: 'flex',
                weekday: 'w-8 text-center text-[10px] font-normal text-muted-foreground',
                weeks: '',
                week: 'mt-0.5 flex',
                day: 'size-8 p-0 text-center',
                day_button:
                    'size-8 text-xs outline-none hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring aria-selected:bg-primary aria-selected:text-primary-foreground',
                selected: 'font-medium',
                today: '[&>button]:underline [&>button]:underline-offset-4',
                outside: 'text-muted-foreground/50',
                disabled: 'opacity-40',
                hidden: 'invisible',
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation, className, disabled: _disabled, size: _size, ...rest }) =>
                    orientation === 'left' ? (
                        <ChevronLeft aria-hidden className={className} {...rest} />
                    ) : (
                        <ChevronRight aria-hidden className={className} {...rest} />
                    ),
            }}
            {...props}
        />
    )
}

export { Calendar }
