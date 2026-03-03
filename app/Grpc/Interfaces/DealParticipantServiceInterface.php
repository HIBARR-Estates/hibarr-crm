<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DealParticipant\ListDealParticipantsRequest;
use App\Grpc\Generated\DealParticipant\ListDealParticipantsResponse;
use App\Grpc\Generated\DealParticipant\StreamDealParticipantsRequest;
use App\Grpc\Generated\DealParticipant\DealParticipantBatch;

interface DealParticipantServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.deal_participant.DealParticipantService';

    public function List(ContextInterface $ctx, ListDealParticipantsRequest $in): ListDealParticipantsResponse;

    public function Stream(ContextInterface $ctx, StreamDealParticipantsRequest $in): DealParticipantBatch;
}
