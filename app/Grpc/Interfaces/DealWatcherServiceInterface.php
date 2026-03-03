<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DealWatcher\ListDealWatchersRequest;
use App\Grpc\Generated\DealWatcher\ListDealWatchersResponse;
use App\Grpc\Generated\DealWatcher\StreamDealWatchersRequest;
use App\Grpc\Generated\DealWatcher\DealWatcherBatch;

interface DealWatcherServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.deal_watcher.DealWatcherService';

    public function List(ContextInterface $ctx, ListDealWatchersRequest $in): ListDealWatchersResponse;

    public function Stream(ContextInterface $ctx, StreamDealWatchersRequest $in): DealWatcherBatch;
}
