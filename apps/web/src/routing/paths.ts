type Slug = { slug: string }

export type OrganizationSection = 'members' | 'invitations' | 'groups' | 'keys'
export type FleetSection = 'access'

export function organizationPath(org: Slug) {
    return `/${encodeURIComponent(org.slug)}`
}
export function organizationSettingsPath(org: Slug, section?: OrganizationSection) {
    return `${organizationPath(org)}/settings${section ? `/${section}` : ''}`
}
export function fleetPath(org: Slug, fleet: Slug) {
    return `${organizationPath(org)}/${encodeURIComponent(fleet.slug)}`
}
export function fleetSettingsPath(org: Slug, fleet: Slug, section?: FleetSection) {
    return `${fleetPath(org, fleet)}/settings${section ? `/${section}` : ''}`
}
export function invitationLink(token: string) {
    return `${window.location.origin}/invite/${encodeURIComponent(token)}`
}
export function passwordResetLink(token: string) {
    return `${window.location.origin}/reset-password?token=${encodeURIComponent(token)}`
}
