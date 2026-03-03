<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\Package\ListPackagesRequest;
use App\Grpc\Generated\Package\ListPackagesResponse;
use App\Grpc\Generated\Package\StreamPackagesRequest;
use App\Grpc\Generated\Package\PackageBatch;

interface PackageServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.package.PackageService';

    public function List(ContextInterface $ctx, ListPackagesRequest $in): ListPackagesResponse;

    public function Stream(ContextInterface $ctx, StreamPackagesRequest $in): PackageBatch;
}
