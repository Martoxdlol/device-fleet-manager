use fleet_i18n::{Lang, Localize, tr};
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
                "Letters, digits, - and _ only",
                "Solo letras, dígitos, - y _"
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
        }
    }
}
