<?php

return [
    /*
    |--------------------------------------------------------------------------
    | gRPC Server Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for the gRPC server running via RoadRunner.
    |
    */

    'server' => [
        // gRPC server listen address
        'listen' => env('GRPC_LISTEN', 'tcp://0.0.0.0:9001'),
        
        // Worker pool configuration
        'workers' => [
            'num_workers' => env('GRPC_WORKERS', 4),
            'max_jobs' => env('GRPC_MAX_JOBS', 500),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | gRPC Services
    |--------------------------------------------------------------------------
    |
    | Map of gRPC service names to their handler classes.
    | These are used for service registration with RoadRunner.
    |
    */

    'services' => [
        'hibarr.crm.deal.DealService' => \App\Grpc\Services\DealGrpcService::class,
        'hibarr.crm.lead.LeadService' => \App\Grpc\Services\LeadGrpcService::class,
        'hibarr.crm.property.PropertyService' => \App\Grpc\Services\PropertyGrpcService::class,
        'hibarr.crm.task.TaskService' => \App\Grpc\Services\TaskGrpcService::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Interceptors
    |--------------------------------------------------------------------------
    |
    | gRPC interceptors applied to all service calls.
    | Order matters - they are executed in the order listed.
    |
    */

    'interceptors' => [
        \App\Grpc\Interceptors\AuthInterceptor::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Streaming Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for server-streaming RPCs.
    |
    */

    'streaming' => [
        // Default batch size for streaming operations
        'batch_size' => env('GRPC_STREAM_BATCH_SIZE', 300),
        
        // Maximum batch size allowed
        'max_batch_size' => 1000,
    ],

    /*
    |--------------------------------------------------------------------------
    | Health Check
    |--------------------------------------------------------------------------
    |
    | Health check configuration using RoadRunner's built-in status plugin.
    |
    */

    'health' => [
        'enabled' => true,
        'listen' => env('GRPC_HEALTH_LISTEN', '0.0.0.0:2114'),
    ],
];
