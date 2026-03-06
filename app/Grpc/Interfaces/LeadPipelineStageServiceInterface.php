<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\LeadPipelineStage\ListLeadPipelineStagesRequest;
use App\Grpc\Generated\LeadPipelineStage\ListLeadPipelineStagesResponse;
use App\Grpc\Generated\LeadPipelineStage\StreamLeadPipelineStagesRequest;
use App\Grpc\Generated\LeadPipelineStage\LeadPipelineStageBatch;

interface LeadPipelineStageServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.lead_pipeline_stage.LeadPipelineStageService';

    public function List(ContextInterface $ctx, ListLeadPipelineStagesRequest $in): ListLeadPipelineStagesResponse;

    public function Stream(ContextInterface $ctx, StreamLeadPipelineStagesRequest $in): LeadPipelineStageBatch;
}
