import { useContext } from 'react'
import { LinkContext, type LinkProps } from './link-context'

/** An in-app link, rendered by the app through `LinkContext`. */
export function Link(props: LinkProps) {
    const render = useContext(LinkContext)
    if (!render) throw new Error('Link requires LinkContext')
    return render(props)
}
