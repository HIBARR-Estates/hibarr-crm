<?php

return [

    /*
    |--------------------------------------------------------------------------
    | OpenTelemetry Logs Configuration
    |--------------------------------------------------------------------------
    |
    | Configure the OpenTelemetry log exporter that streams application logs
    | to a Signoz instance via the OTLP protocol. Set OTEL_LOGS_ENABLED=false
    | to disable exporting without removing the log channel.
    |
    */

    'logs' => [
        'enabled' => env('OTEL_LOGS_ENABLED', false),
        'level' => env('OTEL_LOG_LEVEL', 'debug'),
    ],

    /*
    |--------------------------------------------------------------------------
    | OpenTelemetry Traces Configuration
    |--------------------------------------------------------------------------
    |
    | Emits one server span per HTTP request (see OpenTelemetryTraceMiddleware)
    | to the same Signoz collector. Spans carry semantic-convention HTTP
    | attributes so Signoz can derive RED metrics (rate/errors/duration) and
    | correlate the active trace_id/span_id into any log record emitted
    | during the request via the otlp log channel.
    |
    | Traces default to the batch processor (unlike logs) so a slow/unreachable
    | collector doesn't add a synchronous HTTP round-trip to every request.
    |
    */

    'traces' => [
        'enabled' => env('OTEL_TRACES_ENABLED', false),
        // Fraction of requests to sample, 0.0-1.0. Applied via a
        // ParentBased(TraceIdRatioBased) sampler so any upstream sampling
        // decision (e.g. a load balancer already emitting trace headers) wins.
        'sampler_ratio' => (float) env('OTEL_TRACES_SAMPLER_RATIO', 1.0),
        'batch_enabled' => env('OTEL_TRACES_BATCH_ENABLED', true),
        // Deliberately short: losing a span to a slow/unreachable collector is
        // fine, blocking the request that's being measured for 10s x 3
        // retries (the transport's own defaults) is not.
        'export_timeout_seconds' => (float) env('OTEL_TRACES_EXPORT_TIMEOUT', 2.0),
        'export_max_retries' => (int) env('OTEL_TRACES_EXPORT_MAX_RETRIES', 1),
    ],

    /*
    |--------------------------------------------------------------------------
    | OTLP Exporter
    |--------------------------------------------------------------------------
    |
    | Endpoint should point to the OTel Collector's OTLP/HTTP receiver.
    | The /v1/logs path is appended automatically by the exporter.
    |
    */

    'exporter' => [
        'endpoint' => env('OTEL_EXPORTER_OTLP_ENDPOINT', 'https://otelcollector.hibarr.org'),
        'protocol' => env('OTEL_EXPORTER_OTLP_PROTOCOL', 'http/protobuf'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Resource Attributes
    |--------------------------------------------------------------------------
    |
    | These attributes are attached to every log record and identify the
    | service in the Signoz UI.
    |
    */

    'resource' => [
        'service_name' => env('OTEL_SERVICE_NAME', 'hibarr-crm'),
        'environment' => env('APP_ENV', 'production'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Batch Processor Tuning
    |--------------------------------------------------------------------------
    |
    | The batch processor buffers log records and flushes them periodically.
    | These defaults are sensible for most deployments. Adjust only if you
    | observe export timeouts or excessive memory usage.
    |
    */

    'batch' => [
        'max_queue_size' => (int) env('OTEL_BSP_MAX_QUEUE_SIZE', 2048),
        'scheduled_delay_ms' => (int) env('OTEL_BSP_SCHEDULE_DELAY', 1000),
        'export_timeout_ms' => (int) env('OTEL_BSP_EXPORT_TIMEOUT', 30000),
        'max_export_batch_size' => (int) env('OTEL_BSP_MAX_EXPORT_BATCH_SIZE', 512),
    ],

];
