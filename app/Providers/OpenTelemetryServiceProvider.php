<?php

namespace App\Providers;

use App\Tracing\TracerProviderFactory;
use OpenTelemetry\API\Trace\TracerProviderInterface;
use OpenTelemetry\SDK\Trace\TracerProvider;
use Illuminate\Support\ServiceProvider;

/**
 * Registers OpenTelemetry services in the Laravel container.
 *
 * Logging, tracing, and (later) metrics are each wired independently and
 * can be toggled via config/opentelemetry.php without affecting the others.
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

        $this->app->singleton(TracerProviderInterface::class, fn () => (new TracerProviderFactory())->build());
    }

    /**
     * Bootstrap services.
     *
     * Force-flushes the trace batch processor at the end of every request.
     * Without this, spans only export on BatchSpanProcessor's internal
     * schedule (checked on the next span start/end) or on shutdown — under
     * PHP-FPM's short-lived-worker model that means a queued span can be
     * silently dropped if the worker recycles before either fires.
     */
    public function boot(): void
    {
        if (config('opentelemetry.traces.enabled')) {
            $this->app->terminating(function () {
                $provider = $this->app->make(TracerProviderInterface::class);

                if ($provider instanceof TracerProvider) {
                    $provider->forceFlush();
                }
            });
        }
    }
}
