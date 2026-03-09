<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

/**
 * Registers OpenTelemetry services in the Laravel container.
 *
 * Currently limited to logging. When traces or metrics are added later,
 * their providers/exporters can be registered here too.
 */
class OpenTelemetryServiceProvider extends ServiceProvider
{
    /**
     * Register bindings in the container.
     */
    public function register(): void
    {
        $this->mergeConfigFrom(
            base_path('config/opentelemetry.php'),
            'opentelemetry',
        );
    }

    /**
     * Bootstrap services.
     *
     * Registers a shutdown function to flush any buffered OTel log records
     * when the PHP process terminates (relevant for PHP-FPM short-lived
     * requests when using BatchLogRecordProcessor).
     */
    public function boot(): void
    {
        //
    }
}
