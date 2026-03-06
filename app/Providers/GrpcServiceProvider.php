<?php

namespace App\Providers;

use App\Grpc\Interceptors\AuthInterceptor;
use App\Grpc\Services\DealGrpcService;
use App\Grpc\Services\LeadGrpcService;
use App\Grpc\Services\PropertyGrpcService;
use App\Grpc\Services\TaskGrpcService;
use App\Grpc\Transformers\DealTransformer;
use App\Grpc\Transformers\LeadTransformer;
use App\Grpc\Transformers\PropertyTransformer;
use App\Grpc\Transformers\TaskTransformer;
use App\Grpc\Services\CrmEventGrpcService;
use App\Grpc\Transformers\CrmEventTransformer;
use App\Services\CrmEventService;
use App\Services\DealCreationService;
use App\Services\LeadService;
use App\Services\PropertyService;
use App\Services\TaskService;
use Illuminate\Support\ServiceProvider;

/**
 * Service Provider for gRPC services.
 * Registers gRPC service implementations, transformers, and interceptors.
 */
class GrpcServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Register transformers as singletons
        $this->app->singleton(DealTransformer::class);
        $this->app->singleton(LeadTransformer::class);
        $this->app->singleton(PropertyTransformer::class);
        $this->app->singleton(TaskTransformer::class);

        // Register gRPC services with their dependencies
        $this->app->singleton(DealGrpcService::class, function ($app) {
            return new DealGrpcService(
                $app->make(DealCreationService::class),
                $app->make(DealTransformer::class)
            );
        });

        $this->app->singleton(LeadGrpcService::class, function ($app) {
            return new LeadGrpcService(
                $app->make(LeadService::class),
                $app->make(LeadTransformer::class)
            );
        });

        $this->app->singleton(PropertyGrpcService::class, function ($app) {
            return new PropertyGrpcService(
                $app->make(PropertyService::class),
                $app->make(PropertyTransformer::class)
            );
        });

        $this->app->singleton(TaskGrpcService::class, function ($app) {
            return new TaskGrpcService(
                $app->make(TaskService::class),
                $app->make(TaskTransformer::class)
            );
        });

        $this->app->singleton(CrmEventGrpcService::class, function ($app) {
            return new CrmEventGrpcService(
                $app->make(CrmEventService::class),
                $app->make(CrmEventTransformer::class),
            );
        });

        $this->app->singleton(CrmEventTransformer::class);

        // Register the auth interceptor
        $this->app->singleton(AuthInterceptor::class);

        // Register gRPC configuration
        $this->mergeConfigFrom(
            __DIR__ . '/../../config/grpc.php',
            'grpc'
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Publish configuration file
        $this->publishes([
            __DIR__ . '/../../config/grpc.php' => config_path('grpc.php'),
        ], 'grpc-config');
    }

    /**
     * Get the services provided by the provider.
     *
     * @return array<string>
     */
    public function provides(): array
    {
        return [
            DealGrpcService::class,
            LeadGrpcService::class,
            PropertyGrpcService::class,
            TaskGrpcService::class,
            DealTransformer::class,
            LeadTransformer::class,
            PropertyTransformer::class,
            TaskTransformer::class,
            AuthInterceptor::class,
        ];
    }
}
