<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\LeadPipeline\ListLeadPipelinesRequest;
use App\Grpc\Generated\LeadPipeline\ListLeadPipelinesResponse;
use App\Grpc\Generated\LeadPipeline\StreamLeadPipelinesRequest;
use App\Grpc\Generated\LeadPipeline\LeadPipelineBatch;

interface LeadPipelineServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.lead_pipeline.LeadPipelineService';

    public function List(ContextInterface $ctx, ListLeadPipelinesRequest $in): ListLeadPipelinesResponse;

    public function Stream(ContextInterface $ctx, StreamLeadPipelinesRequest $in): LeadPipelineBatch;
}
