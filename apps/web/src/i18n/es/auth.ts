import type { Shape } from '../catalog'
import type { auth as en } from '../en/auth'

export const auth = {
    passwordHint: 'Al menos 10 caracteres.',
    login: {
        title: 'Inicia sesión',
        signIn: 'Iniciar sesión',
        signingIn: 'Iniciando sesión',
        setupPending:
            'Esta instalación aún no está configurada. El enlace de configuración está en el registro del servidor.',
        createAccount: 'Crea una cuenta',
    },
    signup: {
        title: 'Crea una cuenta',
        create: 'Crear cuenta',
        creating: 'Creando la cuenta',
        signIn: 'Mejor inicia sesión',
    },
    setup: {
        title: 'Configuración inicial',
        organization: 'Organización',
        create: 'Crear',
        creating: 'Creando',
        done: 'Esta instalación ya está configurada.',
        missingToken:
            'Este enlace de configuración está incompleto. Vuelve a copiarlo del registro del servidor.',
    },
    reset: {
        title: 'Elige una contraseña nueva',
        password: 'Contraseña nueva',
        save: 'Guardar contraseña',
        saving: 'Guardando la contraseña',
        missingToken: 'Este enlace está incompleto. Pide uno nuevo a un administrador.',
    },
    providers: {
        names: { google: 'Google', microsoft: 'Microsoft' },
        continueWith: (provider: string) => `Continuar con ${provider}`,
        redirecting: 'Abriendo el proveedor',
    },
    complete: {
        title: 'El inicio de sesión no terminó',
        back: 'Volver a iniciar sesión',
        errors: {
            expired:
                'Este inicio de sesión venció o se empezó en otra pestaña. Vuelve a intentarlo.',
            state_invalid:
                'Este inicio de sesión venció o se empezó en otra pestaña. Vuelve a intentarlo.',
            provider_denied: 'El inicio de sesión se canceló en el proveedor.',
            provider_failed: 'El proveedor no pudo confirmar tu cuenta. Vuelve a intentarlo.',
            no_account:
                'Ninguna cuenta usa este acceso. Pide una invitación a un administrador, o inicia sesión de otra forma y vincúlalo desde tu perfil.',
            email_taken:
                'Ya existe una cuenta con este email. Inicia sesión en ella y vincula este acceso desde tu perfil.',
            email_unverified: 'El proveedor no verificó este email.',
            identity_taken: 'Este acceso ya está vinculado a otra cuenta.',
            provider_already_linked:
                'Tu cuenta ya tiene un acceso de este proveedor. Desvincúlalo primero.',
            invitation_invalid: 'Esta invitación ya no es válida.',
            unavailable: 'Algo salió mal. Vuelve a intentarlo.',
        },
    },
    invite: {
        heading: 'Invitación',
        title: (organization: string) => `Únete a ${organization}`,
        details: (email: string, role: string) => `Para ${email}, con el rol ${role}.`,
        wrongAccount: (email: string) =>
            `Iniciaste sesión como ${email}. Cierra sesión para usar esta invitación.`,
        accept: 'Aceptar invitación',
        accepting: 'Aceptando',
        signInToAccept: 'Inicia sesión para aceptar',
        haveAccount: 'Ya tengo una cuenta',
        createAndJoin: 'Crear cuenta y unirme',
        joining: 'Uniéndome',
    },
} satisfies Shape<typeof en>
