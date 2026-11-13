import type { ListText, TableText } from '../../components/list-text'
import { pluralFor } from '../plural'

const plural = pluralFor('en')

export const components = {
    table: {
        failed: "Couldn't load records",
        moreFailed: "Couldn't load more records",
        loading: 'Fetching records',
        empty: 'No records',
        refreshFailed: "Couldn't refresh records",
        count: (count: number, loaded: string, total: string | undefined, more: boolean) =>
            `${loaded}${total ? ` of ${total}` : ''} ${plural(count, { one: 'record', other: 'records' })}${more ? ' loaded' : ''}`,
    } satisfies TableText,
    combobox: {
        failed: "Couldn't load results",
        moreFailed: "Couldn't load more results",
        loading: 'Loading results',
        empty: 'No results',
    } satisfies ListText & { empty: string },
    picker: {
        placeholder: 'Select an option',
        clear: (label: string) => `Clear ${label}`,
        search: (label: string) => `Search ${label}`,
    },
    confirm: {
        type: (text: string) => `Type ${text} to confirm`,
    },
    keys: {
        enter: 'Enter',
        delete: 'Del',
        shift: 'Shift',
    },
    dataTable: {
        selectAll: 'Select all loaded rows',
        select: (row: string) => `Select ${row}`,
        row: (position: string) => `row ${position}`,
        item: (position: string) => `item ${position}`,
        resize: (column: string) => `Resize ${column}`,
        sortBy: (column: string) => `Sort by ${column}`,
        toolbar: 'Table search, filters and actions',
        activeFilters: (_count: number, active: string) => `Filters (${active} active)`,
        clearFilters: 'Clear filters',
        listView: 'List view',
        gridView: 'Grid view',
        view: 'View',
        layout: 'Layout',
        list: 'List',
        grid: 'Grid',
        tileSize: 'Tile size',
        small: 'Small',
        medium: 'Medium',
        large: 'Large',
        sort: 'Sort by',
        ascending: 'Ascending',
        descending: 'Descending',
        columns: 'Columns',
        resetView: 'Reset view',
        selected: (_count: number, selected: string) => `${selected} selected`,
        moreActions: 'More actions',
    },
    drag: {
        move: (target?: string) => (target ? `Move to ${target}` : 'Move'),
        copy: (target?: string) => (target ? `Copy to ${target}` : 'Copy'),
        upload: (target?: string) => (target ? `Upload to ${target}` : 'Upload'),
        attach: (target?: string) => (target ? `Attach to ${target}` : 'Attach'),
    },
    feedback: {
        dismiss: 'Dismiss',
    },
    account: {
        toggleTheme: 'Toggle theme',
        toDark: 'Switch to dark theme',
        toLight: 'Switch to light theme',
        appearance: 'Appearance',
        menu: 'Account menu',
        profile: 'Your profile',
        admin: 'Administration',
        signOut: 'Sign out',
    },
    brand: {
        home: (name: string) => `${name} home`,
    },
    navigation: {
        organizations: 'Organizations',
        fleets: 'Fleets',
    },
    orgSwitcher: {
        organizations: 'Organizations',
        menu: 'Organization menu',
        menuOf: (name: string) => `Organization menu, ${name}`,
        loading: 'Loading organizations',
        failed: "Couldn't load organizations",
        moreFailed: "Couldn't load more organizations",
    },
    forms: {
        url: 'URL',
        editUrl: (url: string) => `Edit URL ${url}`,
        editUrlTip: 'Edit URL',
        slugHint: 'Lowercase letters and numbers, joined by single hyphens.',
    },
}
