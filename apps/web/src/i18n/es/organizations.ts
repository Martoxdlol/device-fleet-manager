import type { Shape } from '../catalog'
import type { organizations as en } from '../en/organizations'
import { pluralFor } from '../plural'
import { tableText } from './table-text'

const plural = pluralFor('es')

export const organizations = {
    roles: {
        owner: 'Propietario',
        admin: 'Administrador',
        member: 'Miembro',
    },
    menu: {
        all: 'Todas las organizaciones',
        new: 'Nueva organización',
        leave: (organization: string) => `Salir de ${organization}`,
    },
    leave: {
        title: (organization: string) => `¿Salir de ${organization}?`,
        leave: 'Salir',
    },
    list: {
        title: 'Organizaciones',
        role: 'Tu rol',
        empty: 'Aún no perteneces a ninguna organización',
        table: tableText('organización', 'organizaciones', true),
    },
    settings: {
        general: 'General',
        members: 'Miembros',
        invitations: 'Invitaciones',
        groups: 'Grupos',
        keys: 'Claves de agente',
        onlyAdmins: 'Solo los propietarios y administradores pueden ver la configuración',
    },
    general: {
        slugHint: 'Si la cambias, cambian todos los enlaces a esta organización.',
        delete: 'Eliminar organización',
        deleteTitle: (organization: string) => `¿Eliminar ${organization}?`,
    },
    members: {
        label: 'Miembros',
        search: 'Buscar personas',
        you: '(tú)',
        email: 'Correo electrónico',
        role: 'Rol',
        roleOf: (email: string) => `Rol de ${email}`,
        joined: 'Se unió',
        remove: 'Quitar de la organización',
        leave: 'Salir de la organización',
        removeTitle: (name: string) => `¿Quitar a ${name}?`,
        changeOwnRole: (role: string) => `¿Cambiar tu rol a ${role}?`,
        changeRole: 'Cambiar rol',
        noMatch: 'Ninguna persona coincide',
        table: tableText('persona', 'personas', true),
    },
    invitations: {
        label: 'Invitaciones',
        invite: 'Invitar',
        inviteTo: (organization: string) => `Invitar a ${organization}`,
        inviting: 'Invitando',
        email: 'Correo electrónico',
        role: 'Rol',
        expires: 'Vence',
        revoke: 'Revocar invitación',
        revokeTitle: (email: string) => `¿Revocar la invitación de ${email}?`,
        empty: 'No hay invitaciones pendientes',
        linkTitle: (email: string) => `Invitación para ${email}`,
        linkHint: 'Envíale este enlace. Solo se muestra una vez.',
        table: tableText('invitación', 'invitaciones', true),
    },
    groups: {
        label: 'Grupos',
        new: 'Nuevo grupo',
        members: 'Miembros',
        person: 'Persona',
        membersOf: (group: string) => `Miembros de ${group}`,
        addPeople: 'Agregar personas',
        picked: (count: number, shown: string) =>
            plural(count, { one: `${shown} seleccionada`, other: `${shown} seleccionadas` }),
        adding: 'Agregando',
        removeMember: (name: string) => `Quitar a ${name} del grupo`,
        removing: 'Quitando',
        deleteTitle: (group: string) => `¿Eliminar ${group}?`,
        empty: 'Aún no hay grupos',
        noMembers: 'Aún no hay nadie en este grupo',
        table: tableText('grupo', 'grupos', false),
    },
    keys: {
        label: 'Claves de agente',
        new: 'Nueva clave',
        publicKey: 'Clave pública',
        publicKeyOf: (key: string) => `Copiar la clave pública de ${key}`,
        fleets: 'Flotas',
        inUse: 'Hay flotas que usan esta clave',
        deleteTitle: (key: string) => `¿Eliminar ${key}?`,
        empty: 'No hay claves de agente',
        table: tableText('clave', 'claves', true),
    },
} satisfies Shape<typeof en>
