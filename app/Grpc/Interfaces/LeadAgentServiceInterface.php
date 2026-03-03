<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\LeadAgent\ListLeadAgentsRequest;
use App\Grpc\Generated\LeadAgent\ListLeadAgentsResponse;
use App\Grpc\Generated\LeadAgent\StreamLeadAgentsRequest;
use App\Grpc\Generated\LeadAgent\LeadAgentBatch;

interface LeadAgentServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.lead_agent.LeadAgentService';

    public function List(ContextInterface $ctx, ListLeadAgentsRequest $in): ListLeadAgentsResponse;

    public function Stream(ContextInterface $ctx, StreamLeadAgentsRequest $in): LeadAgentBatch;
}
