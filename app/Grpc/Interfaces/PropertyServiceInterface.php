<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\Property\CreatePropertyRequest;
use App\Grpc\Generated\Property\GetPropertyRequest;
use App\Grpc\Generated\Property\UpdatePropertyRequest;
use App\Grpc\Generated\Property\DeletePropertyRequest;
use App\Grpc\Generated\Property\ListPropertiesRequest;
use App\Grpc\Generated\Property\ListPropertiesResponse;
use App\Grpc\Generated\Property\PropertyResponse;
use App\Grpc\Generated\Property\StreamPropertiesRequest;
use App\Grpc\Generated\Property\PropertyBatch;
use App\Grpc\Generated\Common\PBEmpty;

interface PropertyServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.property.PropertyService';

    public function Create(ContextInterface $ctx, CreatePropertyRequest $in): PropertyResponse;

    public function Get(ContextInterface $ctx, GetPropertyRequest $in): PropertyResponse;

    public function Update(ContextInterface $ctx, UpdatePropertyRequest $in): PropertyResponse;

    public function Delete(ContextInterface $ctx, DeletePropertyRequest $in): PBEmpty;

    public function List(ContextInterface $ctx, ListPropertiesRequest $in): ListPropertiesResponse;

    public function Stream(ContextInterface $ctx, StreamPropertiesRequest $in): PropertyBatch;
}
