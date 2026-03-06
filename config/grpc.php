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
        'hibarr.crm.communication_activity.CommunicationActivityService' => \App\Grpc\Services\CommunicationActivityGrpcService::class,
        'hibarr.crm.communication_activity_file.CommunicationActivityFileService' => \App\Grpc\Services\CommunicationActivityFileGrpcService::class,
        'hibarr.crm.country.CountryService' => \App\Grpc\Services\CountryGrpcService::class,
        'hibarr.crm.currency.CurrencyService' => \App\Grpc\Services\CurrencyGrpcService::class,
        'hibarr.crm.deal.DealService' => \App\Grpc\Services\DealGrpcService::class,
        'hibarr.crm.deal_file.DealFileService' => \App\Grpc\Services\DealFileGrpcService::class,
        'hibarr.crm.deal_follow_up.DealFollowUpService' => \App\Grpc\Services\DealFollowUpGrpcService::class,
        'hibarr.crm.deal_history.DealHistoryService' => \App\Grpc\Services\DealHistoryGrpcService::class,
        'hibarr.crm.deal_note.DealNoteService' => \App\Grpc\Services\DealNoteGrpcService::class,
        'hibarr.crm.deal_participant.DealParticipantService' => \App\Grpc\Services\DealParticipantGrpcService::class,
        'hibarr.crm.deal_watcher.DealWatcherService' => \App\Grpc\Services\DealWatcherGrpcService::class,
        'hibarr.crm.developer.DeveloperService' => \App\Grpc\Services\DeveloperGrpcService::class,
        'hibarr.crm.developer_project.DeveloperProjectService' => \App\Grpc\Services\DeveloperProjectGrpcService::class,
        'hibarr.crm.developer_project_asset.DeveloperProjectAssetService' => \App\Grpc\Services\DeveloperProjectAssetGrpcService::class,
        'hibarr.crm.developer_project_unit_type.DeveloperProjectUnitTypeService' => \App\Grpc\Services\DeveloperProjectUnitTypeGrpcService::class,
        'hibarr.crm.developer_project_unit_type_asset.DeveloperProjectUnitTypeAssetService' => \App\Grpc\Services\DeveloperProjectUnitTypeAssetGrpcService::class,
        'hibarr.crm.hibarr_deal_fields.HibarrDealFieldsService' => \App\Grpc\Services\HibarrDealFieldsGrpcService::class,
        'hibarr.crm.lead.LeadService' => \App\Grpc\Services\LeadGrpcService::class,
        'hibarr.crm.lead_agent.LeadAgentService' => \App\Grpc\Services\LeadAgentGrpcService::class,
        'hibarr.crm.lead_category.LeadCategoryService' => \App\Grpc\Services\LeadCategoryGrpcService::class,
        'hibarr.crm.lead_marketing.LeadMarketingService' => \App\Grpc\Services\LeadMarketingGrpcService::class,
        'hibarr.crm.lead_pipeline.LeadPipelineService' => \App\Grpc\Services\LeadPipelineGrpcService::class,
        'hibarr.crm.lead_pipeline_stage.LeadPipelineStageService' => \App\Grpc\Services\LeadPipelineStageGrpcService::class,
        'hibarr.crm.lead_source.LeadSourceService' => \App\Grpc\Services\LeadSourceGrpcService::class,
        'hibarr.crm.lead_status.LeadStatusService' => \App\Grpc\Services\LeadStatusGrpcService::class,
        'hibarr.crm.meeting_summary.MeetingSummaryService' => \App\Grpc\Services\MeetingSummaryGrpcService::class,
        'hibarr.crm.meeting_type.MeetingTypeService' => \App\Grpc\Services\MeetingTypeGrpcService::class,
        'hibarr.crm.package.PackageService' => \App\Grpc\Services\PackageGrpcService::class,
        'hibarr.crm.pipeline_stage.PipelineStageService' => \App\Grpc\Services\PipelineStageGrpcService::class,
        'hibarr.crm.property.PropertyService' => \App\Grpc\Services\PropertyGrpcService::class,
        'hibarr.crm.property_asset.PropertyAssetService' => \App\Grpc\Services\PropertyAssetGrpcService::class,
        'hibarr.crm.task.TaskService' => \App\Grpc\Services\TaskGrpcService::class,
        'hibarr.crm.taskable.TaskableService' => \App\Grpc\Services\TaskableGrpcService::class,
        'hibarr.crm.taskboard_column.TaskboardColumnService' => \App\Grpc\Services\TaskboardColumnGrpcService::class,
        'hibarr.crm.task_category.TaskCategoryService' => \App\Grpc\Services\TaskCategoryGrpcService::class,
        'hibarr.crm.task_history.TaskHistoryService' => \App\Grpc\Services\TaskHistoryGrpcService::class,
        'hibarr.crm.task_user.TaskUserService' => \App\Grpc\Services\TaskUserGrpcService::class,
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
