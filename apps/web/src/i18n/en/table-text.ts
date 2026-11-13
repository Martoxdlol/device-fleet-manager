import type { TableText } from '../../components/list-text'
import { pluralFor } from '../plural'

const plural = pluralFor('en')

export function tableText(one: string, other: string): TableText {
    return {
        failed: `Couldn't load ${other}`,
        moreFailed: `Couldn't load more ${other}`,
        loading: `Fetching ${other}`,
        empty: `No ${other}`,
        refreshFailed: `Couldn't refresh ${other}`,
        count: (count: number, loaded: string, total: string | undefined, more: boolean) =>
            `${loaded}${total ? ` of ${total}` : ''} ${plural(count, { one, other })}${more ? ' loaded' : ''}`,
    }
}
