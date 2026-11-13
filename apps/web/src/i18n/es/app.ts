import type { Shape } from '../catalog'
import type { app as en } from '../en/app'

export const app = {
    commandBar: {
        placeholder: 'Buscar',
    },
} satisfies Shape<typeof en>
