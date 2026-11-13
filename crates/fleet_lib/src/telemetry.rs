use http::HeaderMap;
use opentelemetry::metrics::{Meter, MeterProvider as _};
use opentelemetry::trace::{TraceContextExt, TracerProvider as _};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_http::{HeaderExtractor, HeaderInjector};
use opentelemetry_otlp::{ExporterBuildError, LogExporter, MetricExporter, SpanExporter};
use opentelemetry_sdk::logs::SdkLoggerProvider;
use opentelemetry_sdk::metrics::SdkMeterProvider;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use opentelemetry_sdk::trace::SdkTracerProvider;
use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, Layer, filter};

const ENDPOINT: &str = "OTEL_EXPORTER_OTLP_ENDPOINT";
const SERVICE: &str = "fleet";

const EXPORT_PLUMBING: [&str; 4] = ["opentelemetry", "hyper", "h2", "reqwest"];

pub struct Telemetry {
    tracer: SdkTracerProvider,
    logger: Option<SdkLoggerProvider>,
    meter: Option<SdkMeterProvider>,
}

impl Telemetry {
    pub fn meter(&self) -> Option<Meter> {
        self.meter.as_ref().map(|provider| provider.meter(SERVICE))
    }
}

impl Drop for Telemetry {
    fn drop(&mut self) {
        let _ = self.tracer.shutdown();
        if let Some(logger) = &self.logger {
            let _ = logger.shutdown();
        }
        if let Some(meter) = &self.meter {
            let _ = meter.shutdown();
        }
    }
}

pub fn init() -> Result<Telemetry, ExporterBuildError> {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let mut tracer = SdkTracerProvider::builder();
    let mut logger = None;
    let mut meter = None;
    if std::env::var_os(ENDPOINT).is_some() {
        tracer = tracer.with_batch_exporter(SpanExporter::builder().with_http().build()?);
        logger = Some(
            SdkLoggerProvider::builder()
                .with_batch_exporter(LogExporter::builder().with_http().build()?)
                .build(),
        );
        meter = Some(
            SdkMeterProvider::builder()
                .with_periodic_exporter(MetricExporter::builder().with_http().build()?)
                .build(),
        );
    }
    let tracer = tracer.build();
    opentelemetry::global::set_text_map_propagator(TraceContextPropagator::new());

    let logs = logger.as_ref().map(|provider| {
        OpenTelemetryTracingBridge::new(provider).with_filter(filter::filter_fn(|metadata| {
            !EXPORT_PLUMBING
                .iter()
                .any(|target| metadata.target().starts_with(target))
        }))
    });
    tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_opentelemetry::layer().with_tracer(tracer.tracer(SERVICE)))
        .with(logs)
        .init();
    Ok(Telemetry {
        tracer,
        logger,
        meter,
    })
}

pub fn trace_id() -> Option<String> {
    let context = Span::current().context();
    let span = context.span();
    let span_context = span.span_context();
    span_context
        .is_valid()
        .then(|| span_context.trace_id().to_string())
}

pub fn trace_headers() -> HeaderMap {
    let context = Span::current().context();
    let mut headers = HeaderMap::new();
    opentelemetry::global::get_text_map_propagator(|propagator| {
        propagator.inject_context(&context, &mut HeaderInjector(&mut headers));
    });
    headers
}

pub fn continue_trace(span: &Span, headers: &HeaderMap) {
    let parent = opentelemetry::global::get_text_map_propagator(|propagator| {
        propagator.extract(&HeaderExtractor(headers))
    });
    let _ = span.set_parent(parent);
}
