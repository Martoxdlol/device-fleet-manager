import type { TableText } from '../../components/list-text'
import { pluralFor } from '../plural'

const plural = pluralFor('es')

export function tableText(one: string, other: string, feminine: boolean): TableText {
    const article = feminine ? 'las' : 'los'
    return {
        failed: `No se pudieron cargar ${article} ${other}`,
        moreFailed: `No se pudieron cargar más ${other}`,
        loading: `Cargando ${other}`,
        empty: `No hay ${other}`,
        refreshFailed: `No se pudieron actualizar ${article} ${other}`,
        count: (count: number, loaded: string, total: string | undefined, more: boolean) =>
            `${loaded}${total ? ` de ${total}` : ''} ${plural(count, { one, other })}${
                more
                    ? ` ${plural(count, feminine ? { one: 'cargada', other: 'cargadas' } : { one: 'cargado', other: 'cargados' })}`
                    : ''
            }`,
    }
}
