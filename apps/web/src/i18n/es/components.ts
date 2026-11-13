import type { Shape } from '../catalog'
import type { components as en } from '../en/components'
import { pluralFor } from '../plural'

const plural = pluralFor('es')

export const components = {
    table: {
        failed: 'No se pudieron cargar los registros',
        moreFailed: 'No se pudieron cargar más registros',
        loading: 'Cargando registros',
        empty: 'No hay registros',
        refreshFailed: 'No se pudieron actualizar los registros',
        count: (count: number, loaded: string, total: string | undefined, more: boolean) =>
            `${loaded}${total ? ` de ${total}` : ''} ${plural(count, { one: 'registro', other: 'registros' })}${more ? ` ${plural(count, { one: 'cargado', other: 'cargados' })}` : ''}`,
    },
    combobox: {
        failed: 'No se pudieron cargar los resultados',
        moreFailed: 'No se pudieron cargar más resultados',
        loading: 'Cargando resultados',
        empty: 'No hay resultados',
    },
    picker: {
        placeholder: 'Elige una opción',
        clear: (label: string) => `Borrar ${label}`,
        search: (label: string) => `Buscar en ${label}`,
    },
    confirm: {
        type: (text: string) => `Escribe ${text} para confirmar`,
    },
    keys: {
        enter: 'Intro',
        delete: 'Supr',
        shift: 'Mayús',
    },
    dataTable: {
        selectAll: 'Seleccionar todas las filas cargadas',
        select: (row: string) => `Seleccionar ${row}`,
        row: (position: string) => `fila ${position}`,
        item: (position: string) => `elemento ${position}`,
        resize: (column: string) => `Cambiar el tamaño de ${column}`,
        sortBy: (column: string) => `Ordenar por ${column}`,
        toolbar: 'Búsqueda, filtros y acciones de la tabla',
        activeFilters: (count: number, active: string) =>
            plural(count, {
                one: `Filtros (${active} activo)`,
                other: `Filtros (${active} activos)`,
            }),
        clearFilters: 'Borrar filtros',
        listView: 'Vista de lista',
        gridView: 'Vista de cuadrícula',
        view: 'Vista',
        layout: 'Diseño',
        list: 'Lista',
        grid: 'Cuadrícula',
        tileSize: 'Tamaño de los mosaicos',
        small: 'Pequeño',
        medium: 'Mediano',
        large: 'Grande',
        sort: 'Ordenar por',
        ascending: 'Ascendente',
        descending: 'Descendente',
        columns: 'Columnas',
        resetView: 'Restablecer vista',
        selected: (_count: number, selected: string) => `Selección: ${selected}`,
        moreActions: 'Más acciones',
    },
    drag: {
        move: (target?: string) => (target ? `Mover a ${target}` : 'Mover'),
        copy: (target?: string) => (target ? `Copiar a ${target}` : 'Copiar'),
        upload: (target?: string) => (target ? `Subir a ${target}` : 'Subir'),
        attach: (target?: string) => (target ? `Adjuntar a ${target}` : 'Adjuntar'),
    },
    feedback: {
        dismiss: 'Descartar',
    },
    account: {
        toggleTheme: 'Cambiar tema',
        toDark: 'Cambiar al tema oscuro',
        toLight: 'Cambiar al tema claro',
        appearance: 'Apariencia',
        menu: 'Menú de la cuenta',
        profile: 'Tu perfil',
        admin: 'Administración',
        signOut: 'Cerrar sesión',
    },
    brand: {
        home: (name: string) => `Inicio de ${name}`,
    },
    navigation: {
        organizations: 'Organizaciones',
        fleets: 'Flotas',
    },
    orgSwitcher: {
        organizations: 'Organizaciones',
        menu: 'Menú de la organización',
        menuOf: (name: string) => `Menú de la organización, ${name}`,
        loading: 'Cargando organizaciones',
        failed: 'No se pudieron cargar las organizaciones',
        moreFailed: 'No se pudieron cargar más organizaciones',
    },
    forms: {
        url: 'URL',
        editUrl: (url: string) => `Editar la URL ${url}`,
        editUrlTip: 'Editar la URL',
        slugHint: 'Letras minúsculas y números, unidos por guiones simples.',
    },
} satisfies Shape<typeof en>
