import { tableText } from './table-text'

export const account = {
    profile: {
        title: 'Profile',
        currentPassword: 'Current password',
        newPassword: 'New password',
        passwordHint: 'At least 10 characters. Your other sessions are signed out.',
        changePassword: 'Change password',
        setPassword: 'Set password',
        changing: 'Changing password',
        passwordChanged: 'Password changed',
        methods: {
            title: 'Sign-in methods',
            linked: 'Linked',
            notLinked: 'Not linked',
            link: 'Link',
            linking: 'Linking',
            unlink: 'Unlink',
            unlinking: 'Unlinking',
        },
    },
    admin: {
        title: 'Administration',
        label: 'Users',
        search: 'Search users',
        instanceAdmin: 'Instance admin',
        instanceAdminOf: (email: string) => `${email} is an instance admin`,
        resetLink: 'Create a password reset link',
        creatingLink: 'Creating link',
        resetTitle: (name: string) => `Password reset for ${name}`,
        resetHint: 'Send this link to them. Using it signs them out everywhere else.',
        onlyAdmins: 'Only instance admins can see this page',
        noMatch: 'No matching users',
        table: tableText('user', 'users'),
    },
}
