<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\Task\CreateTaskRequest;
use App\Grpc\Generated\Task\GetTaskRequest;
use App\Grpc\Generated\Task\UpdateTaskRequest;
use App\Grpc\Generated\Task\DeleteTaskRequest;
use App\Grpc\Generated\Task\ChangeTaskStatusRequest;
use App\Grpc\Generated\Task\ListTasksRequest;
use App\Grpc\Generated\Task\ListTasksResponse;
use App\Grpc\Generated\Task\TaskResponse;
use App\Grpc\Generated\Common\PBEmpty;

interface TaskServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.task.TaskService';

    public function Create(ContextInterface $ctx, CreateTaskRequest $in): TaskResponse;

    public function Get(ContextInterface $ctx, GetTaskRequest $in): TaskResponse;

    public function Update(ContextInterface $ctx, UpdateTaskRequest $in): TaskResponse;

    public function Delete(ContextInterface $ctx, DeleteTaskRequest $in): PBEmpty;

    public function ChangeStatus(ContextInterface $ctx, ChangeTaskStatusRequest $in): TaskResponse;

    public function List(ContextInterface $ctx, ListTasksRequest $in): ListTasksResponse;
}
