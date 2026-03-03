<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\MeetingSummary\ListMeetingSummariesRequest;
use App\Grpc\Generated\MeetingSummary\ListMeetingSummariesResponse;
use App\Grpc\Generated\MeetingSummary\StreamMeetingSummariesRequest;
use App\Grpc\Generated\MeetingSummary\MeetingSummaryBatch;

interface MeetingSummaryServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.meeting_summary.MeetingSummaryService';

    public function List(ContextInterface $ctx, ListMeetingSummariesRequest $in): ListMeetingSummariesResponse;

    public function Stream(ContextInterface $ctx, StreamMeetingSummariesRequest $in): MeetingSummaryBatch;
}
