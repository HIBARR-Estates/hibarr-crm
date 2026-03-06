<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DeveloperProjectUnitType\ListDeveloperProjectUnitTypesRequest;
use App\Grpc\Generated\DeveloperProjectUnitType\ListDeveloperProjectUnitTypesResponse;
use App\Grpc\Generated\DeveloperProjectUnitType\StreamDeveloperProjectUnitTypesRequest;
use App\Grpc\Generated\DeveloperProjectUnitType\DeveloperProjectUnitTypeBatch;

interface DeveloperProjectUnitTypeServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.developer_project_unit_type.DeveloperProjectUnitTypeService';

    public function List(ContextInterface $ctx, ListDeveloperProjectUnitTypesRequest $in): ListDeveloperProjectUnitTypesResponse;

    public function Stream(ContextInterface $ctx, StreamDeveloperProjectUnitTypesRequest $in): DeveloperProjectUnitTypeBatch;
}
