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
use App\Grpc\Interfaces\DealServiceInterface;
use App\Grpc\Interfaces\LeadServiceInterface;
use App\Grpc\Interfaces\PropertyServiceInterface;
use App\Grpc\Interfaces\TaskServiceInterface;
use App\Grpc\Services\DealGrpcService;
use App\Grpc\Services\LeadGrpcService;
use App\Grpc\Services\PropertyGrpcService;
use App\Grpc\Services\TaskGrpcService;

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
$server->registerService(DealServiceInterface::class, $app->make(DealGrpcService::class));
$server->registerService(LeadServiceInterface::class, $app->make(LeadGrpcService::class));
$server->registerService(PropertyServiceInterface::class, $app->make(PropertyGrpcService::class));
$server->registerService(TaskServiceInterface::class, $app->make(TaskGrpcService::class));

$server->serve($worker);

