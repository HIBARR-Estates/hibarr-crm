<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\LeadMarketing\ListLeadMarketingsRequest;
use App\Grpc\Generated\LeadMarketing\ListLeadMarketingsResponse;
use App\Grpc\Generated\LeadMarketing\StreamLeadMarketingsRequest;
use App\Grpc\Generated\LeadMarketing\LeadMarketingBatch;

interface LeadMarketingServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.lead_marketing.LeadMarketingService';

    public function List(ContextInterface $ctx, ListLeadMarketingsRequest $in): ListLeadMarketingsResponse;

    public function Stream(ContextInterface $ctx, StreamLeadMarketingsRequest $in): LeadMarketingBatch;
}
