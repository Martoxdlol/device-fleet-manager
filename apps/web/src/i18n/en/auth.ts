export const auth = {
    passwordHint: 'At least 10 characters.',
    login: {
        title: 'Sign in',
        signIn: 'Sign in',
        signingIn: 'Signing in',
        setupPending: 'This installation is not set up yet. The setup link is in the server log.',
        createAccount: 'Create an account',
    },
    signup: {
        title: 'Create an account',
        create: 'Create account',
        creating: 'Creating account',
        signIn: 'Sign in instead',
    },
    setup: {
        title: 'Set up',
        organization: 'Organization',
        create: 'Create',
        creating: 'Creating',
        done: 'This installation is already set up.',
        missingToken: 'This setup link is incomplete. Copy it again from the server log.',
    },
    reset: {
        title: 'Set a new password',
        password: 'New password',
        save: 'Save password',
        saving: 'Saving password',
        missingToken: 'This link is incomplete. Ask an administrator for a new one.',
    },
    providers: {
        names: { google: 'Google', microsoft: 'Microsoft' },
        continueWith: (provider: string) => `Continue with ${provider}`,
        redirecting: 'Opening the provider',
    },
    complete: {
        title: 'Sign-in did not finish',
        back: 'Back to sign in',
        errors: {
            expired: 'This sign-in expired or was started in another tab. Try again.',
            state_invalid: 'This sign-in expired or was started in another tab. Try again.',
            provider_denied: 'The sign-in was cancelled at the provider.',
            provider_failed: 'The provider could not confirm your account. Try again.',
            no_account:
                'No account uses this login. Ask an admin for an invitation, or sign in another way and link it from your profile.',
            email_taken:
                'An account with this email already exists. Sign in to it and link this login from your profile.',
            email_unverified: 'The provider has not verified this email address.',
            identity_taken: 'This login is already linked to another account.',
            provider_already_linked:
                'Your account already has a login from this provider. Unlink it first.',
            invitation_invalid: 'This invitation is no longer valid.',
            unavailable: 'Something went wrong. Try again.',
        },
    },
    invite: {
        heading: 'Invitation',
        title: (organization: string) => `Join ${organization}`,
        details: (email: string, role: string) => `For ${email}, as ${role}.`,
        wrongAccount: (email: string) =>
            `You're signed in as ${email}. Sign out to use this invitation.`,
        accept: 'Accept invitation',
        accepting: 'Accepting',
        signInToAccept: 'Sign in to accept',
        haveAccount: 'I already have an account',
        createAndJoin: 'Create account and join',
        joining: 'Joining',
    },
}
