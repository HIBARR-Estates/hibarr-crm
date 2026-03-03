<?php

/**
 * RoadRunner gRPC Worker
 * 
 * Bootstraps Laravel and registers gRPC services for RoadRunner.
 */

use Spiral\RoadRunner\Worker;
use Spiral\RoadRunner\GRPC\Server;
use Spiral\RoadRunner\GRPC\Invoker;
use App\Grpc\Interceptors\AuthenticatingInvoker;
use App\Grpc\Interfaces\CommunicationActivityServiceInterface;
use App\Grpc\Interfaces\CommunicationActivityFileServiceInterface;
use App\Grpc\Interfaces\CountryServiceInterface;
use App\Grpc\Interfaces\CurrencyServiceInterface;
use App\Grpc\Interfaces\DealServiceInterface;
use App\Grpc\Interfaces\DealFileServiceInterface;
use App\Grpc\Interfaces\DealFollowUpServiceInterface;
use App\Grpc\Interfaces\DealHistoryServiceInterface;
use App\Grpc\Interfaces\DealNoteServiceInterface;
use App\Grpc\Interfaces\DealParticipantServiceInterface;
use App\Grpc\Interfaces\DealWatcherServiceInterface;
use App\Grpc\Interfaces\DeveloperServiceInterface;
use App\Grpc\Interfaces\DeveloperProjectServiceInterface;
use App\Grpc\Interfaces\DeveloperProjectAssetServiceInterface;
use App\Grpc\Interfaces\DeveloperProjectUnitTypeServiceInterface;
use App\Grpc\Interfaces\DeveloperProjectUnitTypeAssetServiceInterface;
use App\Grpc\Interfaces\HibarrDealFieldsServiceInterface;
use App\Grpc\Interfaces\LeadServiceInterface;
use App\Grpc\Interfaces\LeadAgentServiceInterface;
use App\Grpc\Interfaces\LeadCategoryServiceInterface;
use App\Grpc\Interfaces\LeadMarketingServiceInterface;
use App\Grpc\Interfaces\LeadPipelineServiceInterface;
use App\Grpc\Interfaces\LeadPipelineStageServiceInterface;
use App\Grpc\Interfaces\LeadSourceServiceInterface;
use App\Grpc\Interfaces\LeadStatusServiceInterface;
use App\Grpc\Interfaces\MeetingSummaryServiceInterface;
use App\Grpc\Interfaces\MeetingTypeServiceInterface;
use App\Grpc\Interfaces\PackageServiceInterface;
use App\Grpc\Interfaces\PipelineStageServiceInterface;
use App\Grpc\Interfaces\PropertyServiceInterface;
use App\Grpc\Interfaces\PropertyAssetServiceInterface;
use App\Grpc\Interfaces\TaskServiceInterface;
use App\Grpc\Interfaces\TaskableServiceInterface;
use App\Grpc\Interfaces\TaskboardColumnServiceInterface;
use App\Grpc\Interfaces\TaskCategoryServiceInterface;
use App\Grpc\Interfaces\TaskHistoryServiceInterface;
use App\Grpc\Interfaces\TaskUserServiceInterface;
use App\Grpc\Services\CommunicationActivityGrpcService;
use App\Grpc\Services\CommunicationActivityFileGrpcService;
use App\Grpc\Services\CountryGrpcService;
use App\Grpc\Services\CurrencyGrpcService;
use App\Grpc\Services\DealGrpcService;
use App\Grpc\Services\DealFileGrpcService;
use App\Grpc\Services\DealFollowUpGrpcService;
use App\Grpc\Services\DealHistoryGrpcService;
use App\Grpc\Services\DealNoteGrpcService;
use App\Grpc\Services\DealParticipantGrpcService;
use App\Grpc\Services\DealWatcherGrpcService;
use App\Grpc\Services\DeveloperGrpcService;
use App\Grpc\Services\DeveloperProjectGrpcService;
use App\Grpc\Services\DeveloperProjectAssetGrpcService;
use App\Grpc\Services\DeveloperProjectUnitTypeGrpcService;
use App\Grpc\Services\DeveloperProjectUnitTypeAssetGrpcService;
use App\Grpc\Services\HibarrDealFieldsGrpcService;
use App\Grpc\Services\LeadGrpcService;
use App\Grpc\Services\LeadAgentGrpcService;
use App\Grpc\Services\LeadCategoryGrpcService;
use App\Grpc\Services\LeadMarketingGrpcService;
use App\Grpc\Services\LeadPipelineGrpcService;
use App\Grpc\Services\LeadPipelineStageGrpcService;
use App\Grpc\Services\LeadSourceGrpcService;
use App\Grpc\Services\LeadStatusGrpcService;
use App\Grpc\Services\MeetingSummaryGrpcService;
use App\Grpc\Services\MeetingTypeGrpcService;
use App\Grpc\Services\PackageGrpcService;
use App\Grpc\Services\PipelineStageGrpcService;
use App\Grpc\Services\PropertyGrpcService;
use App\Grpc\Services\PropertyAssetGrpcService;
use App\Grpc\Services\TaskGrpcService;
use App\Grpc\Services\TaskableGrpcService;
use App\Grpc\Services\TaskboardColumnGrpcService;
use App\Grpc\Services\TaskCategoryGrpcService;
use App\Grpc\Services\TaskHistoryGrpcService;
use App\Grpc\Services\TaskUserGrpcService;

ini_set('display_errors', 'stderr');

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$worker = Worker::create();

// Wrap the default Invoker with the authenticating decorator.
// Every gRPC call is validated (x-api-token + x-company-id) before
// reaching the service handler. The validated company_id is injected
// into the context as 'authenticated_company_id'.
$invoker = new AuthenticatingInvoker(new Invoker());

$server = new Server($invoker, [
    'debug' => config('app.debug', false),
]);

// Register gRPC services (resolved from Laravel container for DI)
$server->registerService(CommunicationActivityServiceInterface::class, $app->make(CommunicationActivityGrpcService::class));
$server->registerService(CommunicationActivityFileServiceInterface::class, $app->make(CommunicationActivityFileGrpcService::class));
$server->registerService(CountryServiceInterface::class, $app->make(CountryGrpcService::class));
$server->registerService(CurrencyServiceInterface::class, $app->make(CurrencyGrpcService::class));
$server->registerService(DealServiceInterface::class, $app->make(DealGrpcService::class));
$server->registerService(DealFileServiceInterface::class, $app->make(DealFileGrpcService::class));
$server->registerService(DealFollowUpServiceInterface::class, $app->make(DealFollowUpGrpcService::class));
$server->registerService(DealHistoryServiceInterface::class, $app->make(DealHistoryGrpcService::class));
$server->registerService(DealNoteServiceInterface::class, $app->make(DealNoteGrpcService::class));
$server->registerService(DealParticipantServiceInterface::class, $app->make(DealParticipantGrpcService::class));
$server->registerService(DealWatcherServiceInterface::class, $app->make(DealWatcherGrpcService::class));
$server->registerService(DeveloperServiceInterface::class, $app->make(DeveloperGrpcService::class));
$server->registerService(DeveloperProjectServiceInterface::class, $app->make(DeveloperProjectGrpcService::class));
$server->registerService(DeveloperProjectAssetServiceInterface::class, $app->make(DeveloperProjectAssetGrpcService::class));
$server->registerService(DeveloperProjectUnitTypeServiceInterface::class, $app->make(DeveloperProjectUnitTypeGrpcService::class));
$server->registerService(DeveloperProjectUnitTypeAssetServiceInterface::class, $app->make(DeveloperProjectUnitTypeAssetGrpcService::class));
$server->registerService(HibarrDealFieldsServiceInterface::class, $app->make(HibarrDealFieldsGrpcService::class));
$server->registerService(LeadServiceInterface::class, $app->make(LeadGrpcService::class));
$server->registerService(LeadAgentServiceInterface::class, $app->make(LeadAgentGrpcService::class));
$server->registerService(LeadCategoryServiceInterface::class, $app->make(LeadCategoryGrpcService::class));
$server->registerService(LeadMarketingServiceInterface::class, $app->make(LeadMarketingGrpcService::class));
$server->registerService(LeadPipelineServiceInterface::class, $app->make(LeadPipelineGrpcService::class));
$server->registerService(LeadPipelineStageServiceInterface::class, $app->make(LeadPipelineStageGrpcService::class));
$server->registerService(LeadSourceServiceInterface::class, $app->make(LeadSourceGrpcService::class));
$server->registerService(LeadStatusServiceInterface::class, $app->make(LeadStatusGrpcService::class));
$server->registerService(MeetingSummaryServiceInterface::class, $app->make(MeetingSummaryGrpcService::class));
$server->registerService(MeetingTypeServiceInterface::class, $app->make(MeetingTypeGrpcService::class));
$server->registerService(PackageServiceInterface::class, $app->make(PackageGrpcService::class));
$server->registerService(PipelineStageServiceInterface::class, $app->make(PipelineStageGrpcService::class));
$server->registerService(PropertyServiceInterface::class, $app->make(PropertyGrpcService::class));
$server->registerService(PropertyAssetServiceInterface::class, $app->make(PropertyAssetGrpcService::class));
$server->registerService(TaskServiceInterface::class, $app->make(TaskGrpcService::class));
$server->registerService(TaskableServiceInterface::class, $app->make(TaskableGrpcService::class));
$server->registerService(TaskboardColumnServiceInterface::class, $app->make(TaskboardColumnGrpcService::class));
$server->registerService(TaskCategoryServiceInterface::class, $app->make(TaskCategoryGrpcService::class));
$server->registerService(TaskHistoryServiceInterface::class, $app->make(TaskHistoryGrpcService::class));
$server->registerService(TaskUserServiceInterface::class, $app->make(TaskUserGrpcService::class));

$server->serve($worker);

