import { createContext, type ComponentProps, type ReactNode } from 'react'

export type LinkProps = Omit<ComponentProps<'a'>, 'href'> & { to: string }

export const LinkContext = createContext<((props: LinkProps) => ReactNode) | null>(null)
