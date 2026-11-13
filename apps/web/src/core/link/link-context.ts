import { createContext, type ComponentProps, type ReactNode } from 'react'

export type LinkProps = Omit<ComponentProps<'a'>, 'href'> & { to: string }

/** Renders the app's own link, which knows its router and whatever each navigation carries. */
export const LinkContext = createContext<((props: LinkProps) => ReactNode) | null>(null)
