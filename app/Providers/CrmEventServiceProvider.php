<?php

namespace App\Providers;

use App\Grpc\Services\CrmEventGrpcService;
use App\Grpc\Transformers\CrmEventTransformer;
use App\Services\CrmEventService;
use Illuminate\Support\ServiceProvider;

/**
 * Service provider for the CRM Event Record Keeping Engine.
 *
 * Registers the CrmEventService as a singleton, merges default config,
 * and registers the archival console command.
 */
class CrmEventServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Merge default config
        $this->mergeConfigFrom(
            __DIR__ . '/../../config/crm_events.php',
            'crm_events'
        );

        // Register the core service as a singleton
        $this->app->singleton(CrmEventService::class, function ($app) {
            return new CrmEventService();
        });

        // Register the gRPC transformer as a singleton
        $this->app->singleton(CrmEventTransformer::class);

        // Register the gRPC service with its dependencies
        $this->app->singleton(CrmEventGrpcService::class, function ($app) {
            return new CrmEventGrpcService(
                $app->make(CrmEventService::class),
                $app->make(CrmEventTransformer::class),
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Publish config
        $this->publishes([
            __DIR__ . '/../../config/crm_events.php' => config_path('crm_events.php'),
        ], 'crm-events-config');

        // Register artisan commands
        if ($this->app->runningInConsole()) {
            $this->commands([
                \App\Console\Commands\ArchiveCrmEventsCommand::class,
            ]);
        }
    }

    /**
     * Get the services provided by the provider.
     *
     * @return array<string>
     */
    public function provides(): array
    {
        return [
            CrmEventService::class,
            CrmEventGrpcService::class,
            CrmEventTransformer::class,
        ];
    }
}
