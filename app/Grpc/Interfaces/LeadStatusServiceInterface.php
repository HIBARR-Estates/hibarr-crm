<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\LeadStatus\ListLeadStatusesRequest;
use App\Grpc\Generated\LeadStatus\ListLeadStatusesResponse;
use App\Grpc\Generated\LeadStatus\StreamLeadStatusesRequest;
use App\Grpc\Generated\LeadStatus\LeadStatusBatch;

interface LeadStatusServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.lead_status.LeadStatusService';

    public function List(ContextInterface $ctx, ListLeadStatusesRequest $in): ListLeadStatusesResponse;

    public function Stream(ContextInterface $ctx, StreamLeadStatusesRequest $in): LeadStatusBatch;
}
