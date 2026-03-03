<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\Developer\ListDevelopersRequest;
use App\Grpc\Generated\Developer\ListDevelopersResponse;
use App\Grpc\Generated\Developer\StreamDevelopersRequest;
use App\Grpc\Generated\Developer\DeveloperBatch;

interface DeveloperServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.developer.DeveloperService';

    public function List(ContextInterface $ctx, ListDevelopersRequest $in): ListDevelopersResponse;

    public function Stream(ContextInterface $ctx, StreamDevelopersRequest $in): DeveloperBatch;
}
