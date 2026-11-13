import { Link, Navigate, type LinkProps, type NavigateProps } from 'react-router'
import { useCarry } from './navigation'

export function AppLink({ to, ...props }: Omit<LinkProps, 'to'> & { to: string }) {
    const carry = useCarry()
    return <Link to={carry(to)} {...props} />
}

export function AppNavigate({ to, ...props }: Omit<NavigateProps, 'to'> & { to: string }) {
    const carry = useCarry()
    return <Navigate to={carry(to)} {...props} />
}
