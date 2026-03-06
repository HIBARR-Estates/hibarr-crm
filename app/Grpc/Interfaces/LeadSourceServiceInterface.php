<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\LeadSource\ListLeadSourcesRequest;
use App\Grpc\Generated\LeadSource\ListLeadSourcesResponse;
use App\Grpc\Generated\LeadSource\StreamLeadSourcesRequest;
use App\Grpc\Generated\LeadSource\LeadSourceBatch;

interface LeadSourceServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.lead_source.LeadSourceService';

    public function List(ContextInterface $ctx, ListLeadSourcesRequest $in): ListLeadSourcesResponse;

    public function Stream(ContextInterface $ctx, StreamLeadSourcesRequest $in): LeadSourceBatch;
}
