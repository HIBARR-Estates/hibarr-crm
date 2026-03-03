<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\PipelineStage\ListPipelineStagesRequest;
use App\Grpc\Generated\PipelineStage\ListPipelineStagesResponse;
use App\Grpc\Generated\PipelineStage\StreamPipelineStagesRequest;
use App\Grpc\Generated\PipelineStage\PipelineStageBatch;

interface PipelineStageServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.pipeline_stage.PipelineStageService';

    public function List(ContextInterface $ctx, ListPipelineStagesRequest $in): ListPipelineStagesResponse;

    public function Stream(ContextInterface $ctx, StreamPipelineStagesRequest $in): PipelineStageBatch;
}
