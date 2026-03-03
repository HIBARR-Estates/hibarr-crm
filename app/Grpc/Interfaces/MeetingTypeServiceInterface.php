<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\MeetingType\ListMeetingTypesRequest;
use App\Grpc\Generated\MeetingType\ListMeetingTypesResponse;
use App\Grpc\Generated\MeetingType\StreamMeetingTypesRequest;
use App\Grpc\Generated\MeetingType\MeetingTypeBatch;

interface MeetingTypeServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.meeting_type.MeetingTypeService';

    public function List(ContextInterface $ctx, ListMeetingTypesRequest $in): ListMeetingTypesResponse;

    public function Stream(ContextInterface $ctx, StreamMeetingTypesRequest $in): MeetingTypeBatch;
}
