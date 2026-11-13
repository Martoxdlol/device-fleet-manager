import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    listIdentitiesOptions,
    listIdentitiesQueryKey,
    unlinkIdentityMutation,
} from '@fleet/client/react-query'
import { useAuth } from '../../auth/auth-context'
import { instanceQuery } from '../../auth/instance'
import { signInProviders, useProviderSignIn } from '../../auth/provider-sign-in'
import { Button, Spinner, Surface } from '../../core/ui/primitives'
import { errorMessage } from '../../lib/api/errors'
import { useMessages } from '../../i18n/provider'

export function SignInMethods() {
    const { api } = useAuth()
    const t = useMessages()
    const text = t.account.profile.methods
    const cache = useQueryClient()
    const instance = useQuery(instanceQuery(api))
    const identities = useQuery(listIdentitiesOptions({ client: api }))
    const link = useProviderSignIn(api)
    const unlink = useMutation({
        ...unlinkIdentityMutation({ client: api }),
        onSettled: () =>
            cache.invalidateQueries({ queryKey: listIdentitiesQueryKey({ client: api }) }),
    })
    const providers = signInProviders(instance.data?.providers)
    if (!providers.length) return null
    const error = link.error ?? unlink.error
    return (
        <Surface className="flex flex-col gap-3 p-[25px] app-max-md:p-4.5">
            <h2 className="text-[13px] font-medium">{text.title}</h2>
            {providers.map((provider) => {
                const linked = identities.data?.find((identity) => identity.provider === provider)
                const busy =
                    (link.isPending && link.variables?.provider === provider) ||
                    (unlink.isPending && unlink.variables?.path.provider === provider)
                return (
                    <div key={provider} className="flex items-center gap-3 min-h-8">
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="text-xs font-medium">
                                {t.auth.providers.names[provider]}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                                {linked ? (linked.email ?? text.linked) : text.notLinked}
                            </span>
                        </div>
                        {identities.data && (
                            <Button
                                disabled={link.isPending || unlink.isPending}
                                onClick={() =>
                                    linked
                                        ? unlink.mutate({ path: { provider } })
                                        : link.mutate({ provider, returnTo: '/profile' })
                                }
                            >
                                {busy && <Spinner label={linked ? text.unlinking : text.linking} />}
                                {linked ? text.unlink : text.link}
                            </Button>
                        )}
                    </div>
                )
            })}
            {error && (
                <p role="alert" className="text-xs text-destructive">
                    {errorMessage(error, t)}
                </p>
            )}
        </Surface>
    )
}
