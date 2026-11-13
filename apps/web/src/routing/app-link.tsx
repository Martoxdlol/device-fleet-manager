import { Link, type LinkProps } from 'react-router'

export function AppLink({ to, ...props }: Omit<LinkProps, 'to'> & { to: string }) {
    return <Link to={to} {...props} />
}
