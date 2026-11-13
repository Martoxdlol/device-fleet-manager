import type { Shape } from '../catalog'
import type { pages as en } from '../en/pages'

export const pages = {
    notFound: {
        title: 'No encontrada',
        heading: 'Esta página no existe',
    },
} satisfies Shape<typeof en>
