<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DeveloperProjectUnitTypeAsset\ListDeveloperProjectUnitTypeAssetsRequest;
use App\Grpc\Generated\DeveloperProjectUnitTypeAsset\ListDeveloperProjectUnitTypeAssetsResponse;
use App\Grpc\Generated\DeveloperProjectUnitTypeAsset\StreamDeveloperProjectUnitTypeAssetsRequest;
use App\Grpc\Generated\DeveloperProjectUnitTypeAsset\DeveloperProjectUnitTypeAssetBatch;

interface DeveloperProjectUnitTypeAssetServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.developer_project_unit_type_asset.DeveloperProjectUnitTypeAssetService';

    public function List(ContextInterface $ctx, ListDeveloperProjectUnitTypeAssetsRequest $in): ListDeveloperProjectUnitTypeAssetsResponse;

    public function Stream(ContextInterface $ctx, StreamDeveloperProjectUnitTypeAssetsRequest $in): DeveloperProjectUnitTypeAssetBatch;
}
