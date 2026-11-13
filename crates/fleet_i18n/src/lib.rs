use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[cfg_attr(feature = "schema", derive(utoipa::ToSchema))]
#[serde(rename_all = "lowercase")]
pub enum Lang {
    #[default]
    En,
    Es,
}

impl Lang {
    pub const ALL: [Lang; 2] = [Lang::En, Lang::Es];

    pub fn tag(self) -> &'static str {
        match self {
            Lang::En => "en",
            Lang::Es => "es",
        }
    }

    pub fn parse(tag: &str) -> Option<Lang> {
        Lang::ALL.into_iter().find(|lang| lang.tag() == tag)
    }

    pub fn negotiate(header: Option<&str>) -> Lang {
        let Some(header) = header else {
            return Lang::default();
        };
        let mut ranges: Vec<(Lang, f32)> = header
            .split(',')
            .filter_map(|entry| {
                let mut parts = entry.split(';');
                let tag = parts.next()?.trim().to_ascii_lowercase();
                let primary = tag.split('-').next()?;
                let quality = parts
                    .map(str::trim)
                    .find_map(|parameter| parameter.strip_prefix("q="))
                    .map_or(Some(1.0), |weight| weight.trim().parse::<f32>().ok())
                    .unwrap_or(0.0);
                Some((Lang::parse(primary)?, quality))
            })
            .filter(|(_, quality)| *quality > 0.0)
            .collect();
        ranges.sort_by(|a, b| b.1.total_cmp(&a.1));
        ranges.first().map_or(Lang::default(), |(lang, _)| *lang)
    }

    pub fn number(self, n: impl std::fmt::Display) -> String {
        let text = n.to_string();
        let (sign, digits) = match text.strip_prefix('-') {
            Some(digits) => ("-", digits),
            None => ("", text.as_str()),
        };
        let (separator, min_digits) = match self {
            Lang::En => (',', 4),
            Lang::Es => ('.', 5),
        };
        if digits.len() < min_digits || !digits.bytes().all(|b| b.is_ascii_digit()) {
            return text;
        }
        let mut grouped = String::with_capacity(text.len() + digits.len() / 3);
        grouped.push_str(sign);
        for (i, digit) in digits.chars().enumerate() {
            if i > 0 && (digits.len() - i) % 3 == 0 {
                grouped.push(separator);
            }
            grouped.push(digit);
        }
        grouped
    }

    pub fn plural<T>(self, count: u64, one: T, other: T) -> T {
        if count == 1 { one } else { other }
    }
}

pub trait Localize: std::fmt::Debug + Send + Sync {
    fn render(&self, lang: Lang) -> String;
}

impl<T: Localize + ?Sized> Localize for Box<T> {
    fn render(&self, lang: Lang) -> String {
        (**self).render(lang)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct Verbatim(pub String);

impl Localize for Verbatim {
    fn render(&self, _: Lang) -> String {
        self.0.clone()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Text<M> {
    Verbatim(String),
    Message(M),
}

impl<M: Localize> Localize for Text<M> {
    fn render(&self, lang: Lang) -> String {
        match self {
            Text::Verbatim(text) => text.clone(),
            Text::Message(message) => message.render(lang),
        }
    }
}

impl<M> From<M> for Text<M> {
    fn from(message: M) -> Self {
        Text::Message(message)
    }
}

#[macro_export]
macro_rules! tr {
    ($lang:expr, $en:literal, $es:literal $(,)?) => {
        match $lang {
            $crate::Lang::En => format!($en),
            $crate::Lang::Es => format!($es),
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn negotiates_like_the_site() {
        assert_eq!(Lang::negotiate(None), Lang::En);
        assert_eq!(Lang::negotiate(Some("es-AR,es;q=0.9,en;q=0.8")), Lang::Es);
        assert_eq!(Lang::negotiate(Some("fr-FR, es;q=0.5, en;q=0.4")), Lang::Es);
        assert_eq!(Lang::negotiate(Some("en;q=0.2, es;q=0.7")), Lang::Es);
        assert_eq!(Lang::negotiate(Some("es;q=0, en")), Lang::En);
        assert_eq!(Lang::negotiate(Some("es;q=abc, en;q=0.1")), Lang::En);
        assert_eq!(Lang::negotiate(Some("*")), Lang::En);
        assert_eq!(Lang::negotiate(Some("ES")), Lang::Es);
    }

    #[test]
    fn groups_digits_by_language() {
        assert_eq!(Lang::En.number(999), "999");
        assert_eq!(Lang::En.number(1000), "1,000");
        assert_eq!(Lang::En.number(-1234567), "-1,234,567");
        assert_eq!(Lang::Es.number(1000), "1000");
        assert_eq!(Lang::Es.number(10000), "10.000");
        assert_eq!(Lang::Es.number(1234567u64), "1.234.567");
    }

    #[derive(Debug, Serialize, Deserialize, PartialEq)]
    #[serde(tag = "code", rename_all = "snake_case")]
    enum Probe {
        Empty,
        TooLong { max: usize },
    }

    #[test]
    fn stored_text_reads_typed_and_old_rows() {
        let typed: Text<Probe> = serde_json::from_str(r#"{"code":"empty"}"#).unwrap();
        assert_eq!(typed, Text::Message(Probe::Empty));
        let typed: Text<Probe> = serde_json::from_str(r#"{"code":"too_long","max":3}"#).unwrap();
        assert_eq!(typed, Text::Message(Probe::TooLong { max: 3 }));
        let old: Text<Probe> = serde_json::from_str(r#""Must not be empty""#).unwrap();
        assert_eq!(old, Text::Verbatim("Must not be empty".into()));
    }
}
