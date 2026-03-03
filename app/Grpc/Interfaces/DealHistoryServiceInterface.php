<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DealHistory\ListDealHistoriesRequest;
use App\Grpc\Generated\DealHistory\ListDealHistoriesResponse;
use App\Grpc\Generated\DealHistory\StreamDealHistoriesRequest;
use App\Grpc\Generated\DealHistory\DealHistoryBatch;

interface DealHistoryServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.deal_history.DealHistoryService';

    public function List(ContextInterface $ctx, ListDealHistoriesRequest $in): ListDealHistoriesResponse;

    public function Stream(ContextInterface $ctx, StreamDealHistoriesRequest $in): DealHistoryBatch;
}
