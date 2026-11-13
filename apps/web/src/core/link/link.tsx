import { useContext } from 'react'
import { LinkContext, type LinkProps } from './link-context'

export function Link(props: LinkProps) {
    const render = useContext(LinkContext)
    if (!render) throw new Error('Link requires LinkContext')
    return render(props)
}
