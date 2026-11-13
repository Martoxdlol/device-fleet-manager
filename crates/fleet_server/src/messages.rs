use fleet_i18n::{Lang, Localize, tr};
use fleet_lib::model::AccessLevel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum Message {
    InvalidFields,
    SearchTooLong { max: usize },
    BodyNotJson,
    BodyNotJsonContentType,
    BodyTooLarge,
    BodyUnreadable,
    InvalidValue { detail: String },
    ResourceNotFound,
    RouteNotFound,
    MethodNotAllowed,
    Unexpected,
    InvalidCursor,
    Unauthenticated,
    SlugEmpty,
    SlugTooLong { max: usize },
    SlugFormat,
    SlugTaken,
    Empty,
    TooLong { max: usize },
    NameEmpty,
    NameTooLong { max: usize },
    ReferencedNotFound,
    AlreadyExists,
    ConstraintViolated,
    FieldTooLong,
    DatabaseUnavailable,
    DatabaseFailed,
    SlugTooShort { min: usize },
    SlugReserved,
    OrganizationNotFound,
    FleetNotFound,
    GroupNotFound,
    MemberNotFound,
    InvitationNotFound,
    AgentKeyNotFound,
    UserNotFound,
    GrantNotFound,
    OwnerOrAdminRequired,
    OwnerRequired,
    InstanceAdminRequired,
    FleetAccessRequired { level: AccessLevel },
    InvalidCredentials,
    SignupClosed,
    OrgCreationAdminsOnly,
    EmailInvalid,
    EmailTaken,
    PasswordTooShort { min: usize },
    PasswordTooLong { max: usize },
    CurrentPasswordWrong,
    SetupTokenInvalid,
    LastOwner,
    LastInstanceAdmin,
    AlreadyMember,
    InvitationWrongEmail,
    AccountExistsSignIn,
    ResetLinkInvalid,
    AgentKeyInUse,
    NoAgentKey,
    GrantSubject,
    CodeChallengeFormat,
    ReturnToFormat,
    ProviderNotConfigured,
    ProviderUnavailable,
    SignInCodeInvalid,
    IdentityNotFound,
    LastSignIn,
}

impl Localize for Message {
    fn render(&self, lang: Lang) -> String {
        use Message::*;
        match self {
            InvalidFields => tr!(
                lang,
                "Request has invalid fields",
                "La solicitud tiene campos no válidos"
            ),
            SearchTooLong { max } => {
                let max = lang.number(max);
                tr!(
                    lang,
                    "Search must be at most {max} characters",
                    "La búsqueda puede tener como máximo {max} caracteres"
                )
            }
            BodyNotJson => tr!(
                lang,
                "Body is not valid JSON",
                "El cuerpo no es JSON válido"
            ),
            BodyNotJsonContentType => tr!(
                lang,
                "Content-Type must be application/json",
                "Content-Type debe ser application/json"
            ),
            BodyTooLarge => tr!(
                lang,
                "Request body exceeds its size limit",
                "El cuerpo de la solicitud supera su límite de tamaño"
            ),
            BodyUnreadable => tr!(
                lang,
                "Could not read the request body",
                "No se pudo leer el cuerpo de la solicitud"
            ),
            InvalidValue { detail } => tr!(lang, "{detail}", "Valor no válido: {detail}"),
            ResourceNotFound => tr!(lang, "Resource not found", "Recurso no encontrado"),
            RouteNotFound => tr!(
                lang,
                "No route matches this path",
                "Ninguna ruta coincide con esta dirección"
            ),
            MethodNotAllowed => tr!(
                lang,
                "This route does not accept this method",
                "Esta ruta no acepta este método"
            ),
            Unexpected => tr!(
                lang,
                "Unexpected server error",
                "Error inesperado del servidor"
            ),
            InvalidCursor => tr!(
                lang,
                "Cursor is not valid for this endpoint",
                "El cursor no es válido para este endpoint"
            ),
            Unauthenticated => tr!(
                lang,
                "A valid bearer token is required",
                "Se requiere un token bearer válido"
            ),
            SlugEmpty => tr!(
                lang,
                "Slug must not be empty",
                "El slug no puede estar vacío"
            ),
            SlugTooLong { max } => {
                let max = lang.number(max);
                tr!(
                    lang,
                    "Slug must be at most {max} characters",
                    "El slug puede tener como máximo {max} caracteres"
                )
            }
            SlugFormat => tr!(
                lang,
                "Lowercase letters and digits, joined by single hyphens",
                "Letras minúsculas y dígitos, unidos por guiones simples"
            ),
            SlugTaken => tr!(lang, "This slug is taken", "Este slug ya está en uso"),
            Empty => tr!(lang, "Must not be empty", "No puede estar vacío"),
            TooLong { max } => {
                let max = lang.number(max);
                tr!(
                    lang,
                    "Must be at most {max} characters",
                    "Puede tener como máximo {max} caracteres"
                )
            }
            NameEmpty => tr!(
                lang,
                "Name must not be empty",
                "El nombre no puede estar vacío"
            ),
            NameTooLong { max } => {
                let max = lang.number(max);
                tr!(
                    lang,
                    "Name must be at most {max} characters",
                    "El nombre puede tener como máximo {max} caracteres"
                )
            }
            ReferencedNotFound => tr!(
                lang,
                "Referenced resource was not found",
                "No se encontró el recurso referenciado"
            ),
            AlreadyExists => tr!(lang, "Resource already exists", "El recurso ya existe"),
            ConstraintViolated => tr!(
                lang,
                "Request violates a data constraint",
                "La solicitud no cumple una restricción de los datos"
            ),
            FieldTooLong => tr!(
                lang,
                "A field is longer than allowed",
                "Un campo es más largo de lo permitido"
            ),
            DatabaseUnavailable => tr!(
                lang,
                "Database unavailable",
                "La base de datos no está disponible"
            ),
            DatabaseFailed => tr!(
                lang,
                "Database operation failed",
                "Falló la operación en la base de datos"
            ),
            SlugTooShort { min } => {
                let min = lang.number(min);
                tr!(
                    lang,
                    "Slug must be at least {min} characters",
                    "El slug debe tener al menos {min} caracteres"
                )
            }
            SlugReserved => tr!(lang, "This slug is reserved", "Este slug está reservado"),
            OrganizationNotFound => {
                tr!(lang, "Organization not found", "Organización no encontrada")
            }
            FleetNotFound => tr!(lang, "Fleet not found", "Flota no encontrada"),
            GroupNotFound => tr!(lang, "Group not found", "Grupo no encontrado"),
            MemberNotFound => tr!(lang, "Member not found", "Miembro no encontrado"),
            InvitationNotFound => tr!(
                lang,
                "Invitation not found or expired",
                "Invitación no encontrada o vencida"
            ),
            AgentKeyNotFound => tr!(lang, "Agent key not found", "Clave de agente no encontrada"),
            UserNotFound => tr!(lang, "User not found", "Usuario no encontrado"),
            GrantNotFound => tr!(lang, "Access grant not found", "Permiso no encontrado"),
            OwnerOrAdminRequired => tr!(
                lang,
                "Only owners and admins of the organization can do this",
                "Solo los dueños y administradores de la organización pueden hacer esto"
            ),
            OwnerRequired => tr!(
                lang,
                "Only owners of the organization can do this",
                "Solo los dueños de la organización pueden hacer esto"
            ),
            InstanceAdminRequired => tr!(
                lang,
                "Only instance admins can do this",
                "Solo los administradores de la instalación pueden hacer esto"
            ),
            FleetAccessRequired { level } => match level {
                AccessLevel::Read => tr!(
                    lang,
                    "You need read access to this fleet",
                    "Necesitas acceso de lectura a esta flota"
                ),
                AccessLevel::Write => tr!(
                    lang,
                    "You need write access to this fleet",
                    "Necesitas acceso de escritura a esta flota"
                ),
                AccessLevel::Admin => tr!(
                    lang,
                    "You need admin access to this fleet",
                    "Necesitas acceso de administración a esta flota"
                ),
            },
            InvalidCredentials => tr!(
                lang,
                "Email or password is wrong",
                "El email o la contraseña son incorrectos"
            ),
            SignupClosed => tr!(
                lang,
                "Accounts are created by invitation",
                "Las cuentas se crean por invitación"
            ),
            OrgCreationAdminsOnly => tr!(
                lang,
                "Only instance admins can create organizations",
                "Solo los administradores de la instalación pueden crear organizaciones"
            ),
            EmailInvalid => tr!(lang, "Not a valid email address", "No es un email válido"),
            EmailTaken => tr!(
                lang,
                "An account with this email already exists",
                "Ya existe una cuenta con este email"
            ),
            PasswordTooShort { min } => {
                let min = lang.number(min);
                tr!(
                    lang,
                    "Password must be at least {min} characters",
                    "La contraseña debe tener al menos {min} caracteres"
                )
            }
            PasswordTooLong { max } => {
                let max = lang.number(max);
                tr!(
                    lang,
                    "Password must be at most {max} characters",
                    "La contraseña puede tener como máximo {max} caracteres"
                )
            }
            CurrentPasswordWrong => tr!(
                lang,
                "Current password is wrong",
                "La contraseña actual es incorrecta"
            ),
            SetupTokenInvalid => tr!(
                lang,
                "This setup link is not valid anymore",
                "Este enlace de configuración ya no es válido"
            ),
            LastOwner => tr!(
                lang,
                "An organization needs at least one owner",
                "Una organización necesita al menos un dueño"
            ),
            LastInstanceAdmin => tr!(
                lang,
                "The installation needs at least one instance admin",
                "La instalación necesita al menos un administrador"
            ),
            AlreadyMember => tr!(
                lang,
                "This person is already a member",
                "Esta persona ya es miembro"
            ),
            InvitationWrongEmail => tr!(
                lang,
                "This invitation is for another email address",
                "Esta invitación es para otro email"
            ),
            AccountExistsSignIn => tr!(
                lang,
                "An account with this email exists; sign in to accept",
                "Ya existe una cuenta con este email; inicia sesión para aceptar"
            ),
            ResetLinkInvalid => tr!(
                lang,
                "This reset link is not valid anymore",
                "Este enlace para restablecer la contraseña ya no es válido"
            ),
            AgentKeyInUse => tr!(
                lang,
                "Fleets use this key; choose another key for them first",
                "Hay flotas que usan esta clave; elige otra clave para ellas primero"
            ),
            NoAgentKey => tr!(
                lang,
                "The organization has no such agent key",
                "La organización no tiene esa clave de agente"
            ),
            GrantSubject => tr!(
                lang,
                "Give exactly one of user_id and group_id",
                "Indica exactamente uno de user_id y group_id"
            ),
            CodeChallengeFormat => tr!(
                lang,
                "Must be an S256 PKCE challenge",
                "Debe ser un desafío PKCE S256"
            ),
            ReturnToFormat => tr!(
                lang,
                "Must be a path on this site",
                "Debe ser una ruta de este sitio"
            ),
            ProviderNotConfigured => tr!(
                lang,
                "This sign-in provider is not configured",
                "Este proveedor de inicio de sesión no está configurado"
            ),
            ProviderUnavailable => tr!(
                lang,
                "The sign-in provider did not answer; try again",
                "El proveedor de inicio de sesión no respondió; vuelve a intentarlo"
            ),
            SignInCodeInvalid => tr!(
                lang,
                "This sign-in is not valid anymore; sign in again",
                "Este inicio de sesión ya no es válido; vuelve a iniciar sesión"
            ),
            IdentityNotFound => tr!(
                lang,
                "This sign-in method is not linked",
                "Este método de inicio de sesión no está vinculado"
            ),
            LastSignIn => tr!(
                lang,
                "Keep at least one way to sign in",
                "Conserva al menos una forma de iniciar sesión"
            ),
        }
    }
}
