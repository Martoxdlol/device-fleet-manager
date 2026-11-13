import { cn } from 'cn'

export interface OrgLook {
    name: string
}

function organizationInitials(name: string) {
    const [first = [], second] = name
        .trim()
        .split(/\s+/)
        .map((word) => [...word])
    return second
        ? `${first[0]}${second[0]}`.toUpperCase()
        : (first[0] ?? '').toUpperCase() + (first[1] ?? '').toLowerCase()
}

export function OrgAvatar({
    organization,
    className,
}: {
    organization: OrgLook
    className?: string
}) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'org-avatar inline-flex shrink-0 items-center justify-center bg-foreground font-semibold text-background',
                className,
            )}
        >
            {organizationInitials(organization.name)}
        </span>
    )
}
