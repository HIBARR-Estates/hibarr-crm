<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DealFollowUp\ListDealFollowUpsRequest;
use App\Grpc\Generated\DealFollowUp\ListDealFollowUpsResponse;
use App\Grpc\Generated\DealFollowUp\StreamDealFollowUpsRequest;
use App\Grpc\Generated\DealFollowUp\DealFollowUpBatch;

interface DealFollowUpServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.deal_follow_up.DealFollowUpService';

    public function List(ContextInterface $ctx, ListDealFollowUpsRequest $in): ListDealFollowUpsResponse;

    public function Stream(ContextInterface $ctx, StreamDealFollowUpsRequest $in): DealFollowUpBatch;
}
