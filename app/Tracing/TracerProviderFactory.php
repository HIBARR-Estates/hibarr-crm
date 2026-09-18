<?php

namespace App\Tracing;

use OpenTelemetry\API\Common\Time\Clock;
use OpenTelemetry\API\Trace\TracerProviderInterface;
use OpenTelemetry\Contrib\Otlp\ContentTypes;
use OpenTelemetry\Contrib\Otlp\OtlpHttpTransportFactory;
use OpenTelemetry\Contrib\Otlp\SpanExporter;
use OpenTelemetry\SDK\Common\Attribute\Attributes;
use OpenTelemetry\SDK\Resource\ResourceInfo;
use OpenTelemetry\SDK\Trace\Sampler\AlwaysOffSampler;
use OpenTelemetry\SDK\Trace\Sampler\ParentBased;
use OpenTelemetry\SDK\Trace\Sampler\TraceIdRatioBasedSampler;
use OpenTelemetry\SDK\Trace\SpanExporterInterface;
use OpenTelemetry\SDK\Trace\SpanProcessor\BatchSpanProcessor;
use OpenTelemetry\SDK\Trace\SpanProcessor\SimpleSpanProcessor;
use OpenTelemetry\SDK\Trace\SpanProcessorInterface;
use OpenTelemetry\SDK\Trace\TracerProvider;
use OpenTelemetry\SemConv\ResourceAttributes;

/**
 * Builds the request-tracing TracerProvider chain:
 *   Transport → Exporter → Processor → TracerProvider
 *
 * Mirrors App\Logging\OpenTelemetryLogChannel so both pipelines share the
 * same OTLP endpoint, resource attributes, and batch-processor tuning.
 *
 * @see config/opentelemetry.php
 */
class TracerProviderFactory
{
    public function build(): TracerProviderInterface
    {
        if (! config('opentelemetry.traces.enabled')) {
            return new TracerProvider([], new AlwaysOffSampler());
        }

        return TracerProvider::builder()
            ->addSpanProcessor($this->buildProcessor($this->buildExporter()))
            ->setResource($this->buildResource())
            ->setSampler(new ParentBased(
                new TraceIdRatioBasedSampler(config('opentelemetry.traces.sampler_ratio', 1.0)),
            ))
            ->build();
    }

    private function buildExporter(): SpanExporterInterface
    {
        $endpoint = rtrim(config('opentelemetry.exporter.endpoint'), '/') . '/v1/traces';

        $transport = (new OtlpHttpTransportFactory())->create(
            endpoint: $endpoint,
            contentType: ContentTypes::PROTOBUF,
            timeout: config('opentelemetry.traces.export_timeout_seconds', 2.0),
            maxRetries: config('opentelemetry.traces.export_max_retries', 1),
        );

        return new SpanExporter($transport);
    }

    /**
     * Batch by default for traces (unlike the log channel) so a slow or
     * unreachable collector never adds a synchronous HTTP round-trip to the
     * request/response cycle we're trying to measure the latency of.
     *
     * autoFlush must be false: this SDK's BatchSpanProcessor otherwise
     * exports synchronously inside onEnd() for every span (confirmed by
     * direct testing — with autoFlush left at its true default, a span end()
     * blocks exactly like SimpleSpanProcessor would). With it false, spans
     * only accumulate in memory during the request and get flushed once via
     * the terminating() hook in OpenTelemetryServiceProvider — which, on
     * PHP-FPM, runs after Symfony's Response::send() has already called
     * fastcgi_finish_request(), so the flush happens after the client has
     * its response.
     */
    private function buildProcessor(SpanExporterInterface $exporter): SpanProcessorInterface
    {
        if (! config('opentelemetry.traces.batch_enabled', true)) {
            return new SimpleSpanProcessor($exporter);
        }

        return new BatchSpanProcessor(
            $exporter,
            Clock::getDefault(),
            config('opentelemetry.batch.max_queue_size', 2048),
            config('opentelemetry.batch.scheduled_delay_ms', 1000),
            config('opentelemetry.batch.export_timeout_ms', 30000),
            config('opentelemetry.batch.max_export_batch_size', 512),
            autoFlush: false,
        );
    }

    private function buildResource(): ResourceInfo
    {
        return ResourceInfo::create(
            Attributes::create([
                ResourceAttributes::SERVICE_NAME => config('opentelemetry.resource.service_name', 'hibarr-crm'),
                ResourceAttributes::DEPLOYMENT_ENVIRONMENT_NAME => config('opentelemetry.resource.environment', 'production'),
                ResourceAttributes::SERVICE_VERSION => config('app.version', '1.0.0'),
                // Lets the "CRM Reliability" dashboard's hostname variable
                // isolate a single bad instance among a fleet.
                ResourceAttributes::HOST_NAME => gethostname() ?: 'unknown',
            ]),
        );
    }
}
