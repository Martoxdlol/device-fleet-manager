import type { OrgRole } from '@fleet/client'

export function rolesFor(caller: OrgRole): OrgRole[] {
    return caller === 'owner' ? ['member', 'admin', 'owner'] : ['member', 'admin']
}

export function canManage(caller: OrgRole, role: OrgRole) {
    return caller === 'owner' || (caller === 'admin' && role !== 'owner')
}

export function isOrgAdmin(role: OrgRole) {
    return role === 'owner' || role === 'admin'
}
