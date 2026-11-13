import { cn } from 'cn'
import { AppLink } from '../../auth/app-link'
import { PanelHeader, PanelTitle } from '../../core/layout/panel'
import { usePanels } from '../../core/layout/panels-context'
import { Icon, type IconName } from '../../core/ui/icon'

export const rowHover = 'hover:bg-[color-mix(in_oklab,var(--card),var(--foreground)_3.5%)]'
export const rowSelected = 'bg-[color-mix(in_oklab,var(--card),var(--primary)_16%)] font-medium'

export interface Section {
    id: string
    label: string
    icon: IconName
    href: string
}

export function SectionNavigation({
    title,
    sections,
    current,
}: {
    title: string
    sections: Section[]
    current: string
}) {
    const panels = usePanels()
    return (
        <>
            <PanelHeader>
                <PanelTitle>{title}</PanelTitle>
            </PanelHeader>
            <nav aria-label={title} className="flex flex-col py-1">
                {sections.map((item) => (
                    <AppLink
                        key={item.id}
                        to={item.href}
                        aria-current={item.id === current ? 'page' : undefined}
                        onClick={panels.closePanels}
                        className={cn(
                            'flex h-8 items-center gap-2 px-3 text-xs outline-none transition-colors duration-[140ms] focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:stroke-[1.65] [&>svg]:opacity-70',
                            item.id === current ? rowSelected : rowHover,
                        )}
                    >
                        <Icon name={item.icon} />
                        {item.label}
                    </AppLink>
                ))}
            </nav>
        </>
    )
}
