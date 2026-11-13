import type { Shape } from '../catalog'
import type { fleets as en } from '../en/fleets'
import { tableText } from './table-text'

export const fleets = {
    access: {
        read: 'Lectura',
        write: 'Escritura',
        admin: 'Administración',
    },
    list: {
        label: 'Flotas',
        new: 'Nueva flota',
        access: 'Tu acceso',
        empty: 'Aún no hay flotas',
        emptyMember: 'Aún no tienes acceso a ninguna flota',
        table: tableText('flota', 'flotas', true),
    },
    views: {
        overview: 'Resumen',
    },
    switcher: {
        label: (fleet: string) => `Flota, ${fleet}`,
        search: 'Buscar flotas',
        all: 'Todas las flotas',
    },
    home: {
        empty: 'Aún no hay dispositivos',
    },
    settings: {
        general: 'General',
        access: 'Acceso',
        onlyAdmins: 'Solo los administradores de la flota pueden ver la configuración',
        slugHint: 'Si la cambias, cambian todos los enlaces a esta flota.',
        agentKey: 'Clave de agente',
        agentKeyHint: 'Los agentes inscritos en esta flota confían en esta clave.',
        delete: 'Eliminar flota',
        deleteTitle: (fleet: string) => `¿Eliminar ${fleet}?`,
    },
    grants: {
        label: 'Acceso',
        add: 'Dar acceso',
        adding: 'Agregando',
        subject: 'Persona o grupo',
        choose: 'Elige una persona o un grupo',
        level: 'Acceso',
        levelOf: (subject: string) => `Acceso de ${subject}`,
        kind: 'Tipo',
        person: 'Persona',
        group: 'Grupo',
        people: 'Personas',
        groups: 'Grupos',
        remove: 'Quitar acceso',
        removeTitle: (subject: string) => `¿Quitar el acceso de ${subject}?`,
        empty: (organization: string) =>
            `Solo los propietarios y administradores de ${organization} tienen acceso`,
        table: tableText('permiso', 'permisos', false),
    },
} satisfies Shape<typeof en>
