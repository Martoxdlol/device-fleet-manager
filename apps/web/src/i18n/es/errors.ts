import type { Shape } from '../catalog'
import type { errors as en } from '../en/errors'

export const errors = {
    title: 'Error',
    somethingWentWrong: 'Algo salió mal',
    newVersion: 'Hay una nueva versión disponible',
    reload: 'Recargar',
    details: 'Detalles',
    showDetails: 'Ver qué salió mal',
    noDetails: 'Sin detalles',
} satisfies Shape<typeof en>
