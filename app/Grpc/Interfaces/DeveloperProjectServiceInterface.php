<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DeveloperProject\ListDeveloperProjectsRequest;
use App\Grpc\Generated\DeveloperProject\ListDeveloperProjectsResponse;
use App\Grpc\Generated\DeveloperProject\StreamDeveloperProjectsRequest;
use App\Grpc\Generated\DeveloperProject\DeveloperProjectBatch;

interface DeveloperProjectServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.developer_project.DeveloperProjectService';

    public function List(ContextInterface $ctx, ListDeveloperProjectsRequest $in): ListDeveloperProjectsResponse;

    public function Stream(ContextInterface $ctx, StreamDeveloperProjectsRequest $in): DeveloperProjectBatch;
}
