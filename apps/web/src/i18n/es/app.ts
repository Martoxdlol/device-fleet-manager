import type { Shape } from '../catalog'
import type { app as en } from '../en/app'

export const app = {
    commandBar: {
        placeholder: 'Buscar',
    },
    route: {
        title: 'Organización',
        back: 'Volver a las organizaciones',
        opening: 'Abriendo',
    },
} satisfies Shape<typeof en>
