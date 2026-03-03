<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\TaskUser\ListTaskUsersRequest;
use App\Grpc\Generated\TaskUser\ListTaskUsersResponse;
use App\Grpc\Generated\TaskUser\StreamTaskUsersRequest;
use App\Grpc\Generated\TaskUser\TaskUserBatch;

interface TaskUserServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.task_user.TaskUserService';

    public function List(ContextInterface $ctx, ListTaskUsersRequest $in): ListTaskUsersResponse;

    public function Stream(ContextInterface $ctx, StreamTaskUsersRequest $in): TaskUserBatch;
}
