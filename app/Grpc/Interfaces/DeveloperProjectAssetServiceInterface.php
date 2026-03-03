<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DeveloperProjectAsset\ListDeveloperProjectAssetsRequest;
use App\Grpc\Generated\DeveloperProjectAsset\ListDeveloperProjectAssetsResponse;
use App\Grpc\Generated\DeveloperProjectAsset\StreamDeveloperProjectAssetsRequest;
use App\Grpc\Generated\DeveloperProjectAsset\DeveloperProjectAssetBatch;

interface DeveloperProjectAssetServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.developer_project_asset.DeveloperProjectAssetService';

    public function List(ContextInterface $ctx, ListDeveloperProjectAssetsRequest $in): ListDeveloperProjectAssetsResponse;

    public function Stream(ContextInterface $ctx, StreamDeveloperProjectAssetsRequest $in): DeveloperProjectAssetBatch;
}
