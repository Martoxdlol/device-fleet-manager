import { useAppNavigate } from '../../auth/navigation'
import { NamedResourceDialog } from '../../components/forms/named-resource-dialog'
import { organizationPath } from '../../routing/paths'
import { useMessages } from '../../i18n/provider'
import { useCreateOrganization } from './queries'

export function NewOrganizationDialog({ onClose }: { onClose: () => void }) {
    const create = useCreateOrganization()
    const navigate = useAppNavigate()
    const t = useMessages()
    return (
        <NamedResourceDialog
            title={t.organizations.menu.new}
            urlPrefix="/"
            pending={create.isPending}
            error={create.error}
            onClose={onClose}
            onSubmit={(body) =>
                create.mutate(
                    { body },
                    {
                        onSuccess: (org) => {
                            onClose()
                            navigate(organizationPath(org))
                        },
                    },
                )
            }
        />
    )
}
