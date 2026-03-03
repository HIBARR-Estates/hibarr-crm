<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\TaskHistory\ListTaskHistoriesRequest;
use App\Grpc\Generated\TaskHistory\ListTaskHistoriesResponse;
use App\Grpc\Generated\TaskHistory\StreamTaskHistoriesRequest;
use App\Grpc\Generated\TaskHistory\TaskHistoryBatch;

interface TaskHistoryServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.task_history.TaskHistoryService';

    public function List(ContextInterface $ctx, ListTaskHistoriesRequest $in): ListTaskHistoriesResponse;

    public function Stream(ContextInterface $ctx, StreamTaskHistoriesRequest $in): TaskHistoryBatch;
}
