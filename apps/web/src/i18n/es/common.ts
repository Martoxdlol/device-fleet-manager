import type { Shape } from '../catalog'
import type { common as en } from '../en/common'

export const common = {
    cancel: 'Cancelar',
    clearSearch: 'Borrar búsqueda',
    copy: 'Copiar',
    delete: 'Eliminar',
    filters: 'Filtros',
    retry: 'Vuelve a intentarlo',
    retryShort: 'Reintentar',
    search: 'Buscar',
    couldNotConnect: 'No se pudo conectar con el servidor. Vuelve a intentarlo.',
} satisfies Shape<typeof en>
