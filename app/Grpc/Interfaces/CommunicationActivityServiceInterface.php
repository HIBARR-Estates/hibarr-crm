<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\CommunicationActivity\ListCommunicationActivitiesRequest;
use App\Grpc\Generated\CommunicationActivity\ListCommunicationActivitiesResponse;
use App\Grpc\Generated\CommunicationActivity\StreamCommunicationActivitiesRequest;
use App\Grpc\Generated\CommunicationActivity\CommunicationActivityBatch;

interface CommunicationActivityServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.communication_activity.CommunicationActivityService';

    public function List(ContextInterface $ctx, ListCommunicationActivitiesRequest $in): ListCommunicationActivitiesResponse;

    public function Stream(ContextInterface $ctx, StreamCommunicationActivitiesRequest $in): CommunicationActivityBatch;
}
