<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\TaskCategory\ListTaskCategoriesRequest;
use App\Grpc\Generated\TaskCategory\ListTaskCategoriesResponse;
use App\Grpc\Generated\TaskCategory\StreamTaskCategoriesRequest;
use App\Grpc\Generated\TaskCategory\TaskCategoryBatch;

interface TaskCategoryServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.task_category.TaskCategoryService';

    public function List(ContextInterface $ctx, ListTaskCategoriesRequest $in): ListTaskCategoriesResponse;

    public function Stream(ContextInterface $ctx, StreamTaskCategoriesRequest $in): TaskCategoryBatch;
}
