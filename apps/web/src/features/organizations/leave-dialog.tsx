import type { MyOrganization } from '@fleet/client'
import { useAccount } from '../../auth/auth-context'
import { useAppNavigate } from '../../auth/navigation'
import { ConfirmDialog } from '../../components/confirm-dialog'
import { useMessages } from '../../i18n/provider'
import { useLeaveOrganization } from './queries'

export function LeaveOrganizationDialog({
    organization,
    onClose,
}: {
    organization: MyOrganization
    onClose: () => void
}) {
    const { user } = useAccount()
    const leave = useLeaveOrganization(organization)
    const navigate = useAppNavigate()
    const t = useMessages().organizations.leave
    return (
        <ConfirmDialog
            title={t.title(organization.name)}
            label={t.leave}
            onClose={onClose}
            onConfirm={async () => {
                await leave.mutateAsync({ path: { org_id: organization.id, user_id: user.id } })
                navigate('/', { replace: true })
            }}
        />
    )
}
