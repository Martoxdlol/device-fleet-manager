import type { AccessLevel } from '@fleet/client'
import { tableText } from './table-text'

export const fleets = {
    access: {
        read: 'Read',
        write: 'Write',
        admin: 'Admin',
    } satisfies Record<AccessLevel, string>,
    list: {
        label: 'Fleets',
        new: 'New fleet',
        access: 'Your access',
        empty: 'No fleets yet',
        emptyMember: "You don't have access to any fleet yet",
        table: tableText('fleet', 'fleets'),
    },
    views: {
        overview: 'Overview',
    },
    switcher: {
        label: (fleet: string) => `Fleet, ${fleet}`,
        search: 'Search fleets',
        all: 'All fleets',
    },
    home: {
        empty: 'No devices yet',
    },
    settings: {
        general: 'General',
        access: 'Access',
        onlyAdmins: 'Only fleet admins can see settings',
        slugHint: 'Changing it changes every link to this fleet.',
        agentKey: 'Agent key',
        agentKeyHint: 'Agents enrolled in this fleet trust this key.',
        delete: 'Delete fleet',
        deleteTitle: (fleet: string) => `Delete ${fleet}?`,
    },
    grants: {
        label: 'Access',
        add: 'Add access',
        adding: 'Adding',
        subject: 'Person or group',
        choose: 'Choose a person or group',
        level: 'Access',
        levelOf: (subject: string) => `Access of ${subject}`,
        kind: 'Type',
        person: 'Person',
        group: 'Group',
        people: 'People',
        groups: 'Groups',
        remove: 'Remove access',
        removeTitle: (subject: string) => `Remove access for ${subject}?`,
        empty: (organization: string) => `Only owners and admins of ${organization} have access`,
        table: tableText('access grant', 'access grants'),
    },
}
