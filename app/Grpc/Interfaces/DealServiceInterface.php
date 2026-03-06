<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\Deal\CreateDealRequest;
use App\Grpc\Generated\Deal\GetDealRequest;
use App\Grpc\Generated\Deal\UpdateDealRequest;
use App\Grpc\Generated\Deal\DeleteDealRequest;
use App\Grpc\Generated\Deal\ListDealsRequest;
use App\Grpc\Generated\Deal\ListDealsResponse;
use App\Grpc\Generated\Deal\DealResponse;
use App\Grpc\Generated\Deal\StreamDealsRequest;
use App\Grpc\Generated\Deal\DealBatch;
use App\Grpc\Generated\Common\PBEmpty;

interface DealServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.deal.DealService';

    public function Create(ContextInterface $ctx, CreateDealRequest $in): DealResponse;

    public function Get(ContextInterface $ctx, GetDealRequest $in): DealResponse;

    public function Update(ContextInterface $ctx, UpdateDealRequest $in): DealResponse;

    public function Delete(ContextInterface $ctx, DeleteDealRequest $in): PBEmpty;

    public function List(ContextInterface $ctx, ListDealsRequest $in): ListDealsResponse;

    public function Stream(ContextInterface $ctx, StreamDealsRequest $in): DealBatch;
}
