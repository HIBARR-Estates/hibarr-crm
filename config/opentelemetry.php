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
