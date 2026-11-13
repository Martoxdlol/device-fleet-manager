import type { Shape } from '../catalog'
import type { account as en } from '../en/account'
import { tableText } from './table-text'

export const account = {
    profile: {
        title: 'Perfil',
        currentPassword: 'Contraseña actual',
        newPassword: 'Contraseña nueva',
        passwordHint: 'Al menos 10 caracteres. Se cerrarán tus otras sesiones.',
        changePassword: 'Cambiar contraseña',
        setPassword: 'Elegir contraseña',
        changing: 'Cambiando la contraseña',
        passwordChanged: 'Contraseña cambiada',
        methods: {
            title: 'Formas de iniciar sesión',
            linked: 'Vinculado',
            notLinked: 'Sin vincular',
            link: 'Vincular',
            linking: 'Vinculando',
            unlink: 'Desvincular',
            unlinking: 'Desvinculando',
        },
    },
    admin: {
        title: 'Administración',
        label: 'Usuarios',
        search: 'Buscar usuarios',
        instanceAdmin: 'Administrador de la instancia',
        instanceAdminOf: (email: string) => `${email} es administrador de la instancia`,
        resetLink: 'Crear un enlace para restablecer la contraseña',
        creatingLink: 'Creando el enlace',
        resetTitle: (name: string) => `Restablecer la contraseña de ${name}`,
        resetHint: 'Envíale este enlace. Al usarlo, se cierran sus demás sesiones.',
        onlyAdmins: 'Solo los administradores de la instancia pueden ver esta página',
        noMatch: 'Ningún usuario coincide',
        table: tableText('usuario', 'usuarios', false),
    },
} satisfies Shape<typeof en>
