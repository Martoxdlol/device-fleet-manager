import type { Shape } from '../catalog'
import type { pages as en } from '../en/pages'

export const pages = {
    home: {
        title: 'Inicio',
        heading: 'Aún no hay nada aquí',
        description: 'Las organizaciones, flotas y dispositivos aparecerán aquí.',
    },
    notFound: {
        title: 'No encontrada',
        heading: 'Esta página no existe',
    },
} satisfies Shape<typeof en>
