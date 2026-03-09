<?php

namespace App\Logging;

use Monolog\Logger;
use OpenTelemetry\API\Common\Time\Clock;
use OpenTelemetry\Contrib\Logs\Monolog\Handler as OtelHandler;
use OpenTelemetry\Contrib\Otlp\ContentTypes;
use OpenTelemetry\Contrib\Otlp\LogsExporter;
use OpenTelemetry\Contrib\Otlp\OtlpHttpTransportFactory;
use OpenTelemetry\SDK\Common\Attribute\Attributes;
use OpenTelemetry\SDK\Logs\LoggerProvider;
use OpenTelemetry\SDK\Logs\Processor\BatchLogRecordProcessor;
use OpenTelemetry\SDK\Logs\Processor\SimpleLogRecordProcessor;
use OpenTelemetry\SDK\Resource\ResourceInfo;
use OpenTelemetry\SemConv\ResourceAttributes;

/**
 * Laravel log channel factory for OpenTelemetry.
 *
 * Registered as a "custom" driver in config/logging.php and invoked via
 * its __invoke() method. Streams Monolog log records to an OTel Collector
 * (Signoz) over OTLP/HTTP.
 *
 * @see config/opentelemetry.php
 */
class OpenTelemetryLogChannel
{
    /**
     * Create a Monolog Logger instance wired to the OTel logs pipeline.
     *
     * When OTEL_LOGS_ENABLED is false the handler is set to the highest
     * Monolog level (EMERGENCY + 1 trick won't work), so we simply return
     * a Logger with no handlers — effectively a no-op.
     */
    public function __invoke(array $config): Logger
    {
        $logger = new Logger('otlp');

        if (! config('opentelemetry.logs.enabled')) {
            return $logger; // no handlers = silent
        }

        $handler = new OtelHandler(
            $this->buildLoggerProvider(),
            config('opentelemetry.logs.level', 'debug'),
        );

        $logger->pushHandler($handler);

        return $logger;
    }

    /**
     * Build the full OTel LoggerProvider chain:
     *   Transport → Exporter → Processor → LoggerProvider
     */
    private function buildLoggerProvider(): LoggerProvider
    {
        $endpoint = rtrim(config('opentelemetry.exporter.endpoint'), '/') . '/v1/logs';

        $transport = (new OtlpHttpTransportFactory())->create(
            $endpoint,
            ContentTypes::PROTOBUF,
        );

        $exporter = new LogsExporter($transport);

        // Use SimpleLogRecordProcessor for PHP-FPM (short-lived requests)
        // to avoid needing a flush/shutdown hook. For long-running workers
        // (RoadRunner), BatchLogRecordProcessor would be more efficient but
        // SimpleProcessor still works correctly for both runtimes.
        $processor = $this->buildProcessor($exporter);

        $resource = $this->buildResource();

        return LoggerProvider::builder()
            ->addLogRecordProcessor($processor)
            ->setResource($resource)
            ->build();
    }

    /**
     * Select the appropriate log record processor.
     *
     * SimpleLogRecordProcessor exports each record synchronously — safe for
     * PHP-FPM's short request lifecycle and simple for RoadRunner too.
     * Switch to BatchLogRecordProcessor when throughput demands buffering.
     */
    private function buildProcessor(LogsExporter $exporter): SimpleLogRecordProcessor|BatchLogRecordProcessor
    {
        $useBatch = config('opentelemetry.batch.enabled', false);

        if ($useBatch) {
            return new BatchLogRecordProcessor(
                $exporter,
                Clock::getDefault(),
                config('opentelemetry.batch.max_queue_size', 2048),
                config('opentelemetry.batch.scheduled_delay_ms', 1000),
                config('opentelemetry.batch.export_timeout_ms', 30000),
                config('opentelemetry.batch.max_export_batch_size', 512),
            );
        }

        return new SimpleLogRecordProcessor($exporter);
    }

    /**
     * Build OTel resource with service identification attributes.
     */
    private function buildResource(): ResourceInfo
    {
        return ResourceInfo::create(
            Attributes::create([
                ResourceAttributes::SERVICE_NAME => config('opentelemetry.resource.service_name', 'hibarr-crm'),
                ResourceAttributes::DEPLOYMENT_ENVIRONMENT_NAME => config('opentelemetry.resource.environment', 'production'),
                ResourceAttributes::SERVICE_VERSION => config('app.version', '1.0.0'),
            ]),
        );
    }
}
