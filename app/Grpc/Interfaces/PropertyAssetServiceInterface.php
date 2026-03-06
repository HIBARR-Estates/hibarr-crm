<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\PropertyAsset\ListPropertyAssetsRequest;
use App\Grpc\Generated\PropertyAsset\ListPropertyAssetsResponse;
use App\Grpc\Generated\PropertyAsset\StreamPropertyAssetsRequest;
use App\Grpc\Generated\PropertyAsset\PropertyAssetBatch;

interface PropertyAssetServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.property_asset.PropertyAssetService';

    public function List(ContextInterface $ctx, ListPropertyAssetsRequest $in): ListPropertyAssetsResponse;

    public function Stream(ContextInterface $ctx, StreamPropertyAssetsRequest $in): PropertyAssetBatch;
}
