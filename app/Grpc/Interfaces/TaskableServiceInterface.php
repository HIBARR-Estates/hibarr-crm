<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\Taskable\ListTaskablesRequest;
use App\Grpc\Generated\Taskable\ListTaskablesResponse;
use App\Grpc\Generated\Taskable\StreamTaskablesRequest;
use App\Grpc\Generated\Taskable\TaskableBatch;

interface TaskableServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.taskable.TaskableService';

    public function List(ContextInterface $ctx, ListTaskablesRequest $in): ListTaskablesResponse;

    public function Stream(ContextInterface $ctx, StreamTaskablesRequest $in): TaskableBatch;
}
