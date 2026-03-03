<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\TaskboardColumn\ListTaskboardColumnsRequest;
use App\Grpc\Generated\TaskboardColumn\ListTaskboardColumnsResponse;
use App\Grpc\Generated\TaskboardColumn\StreamTaskboardColumnsRequest;
use App\Grpc\Generated\TaskboardColumn\TaskboardColumnBatch;

interface TaskboardColumnServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.taskboard_column.TaskboardColumnService';

    public function List(ContextInterface $ctx, ListTaskboardColumnsRequest $in): ListTaskboardColumnsResponse;

    public function Stream(ContextInterface $ctx, StreamTaskboardColumnsRequest $in): TaskboardColumnBatch;
}
