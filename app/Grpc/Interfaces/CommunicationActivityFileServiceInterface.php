<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\CommunicationActivityFile\ListCommunicationActivityFilesRequest;
use App\Grpc\Generated\CommunicationActivityFile\ListCommunicationActivityFilesResponse;
use App\Grpc\Generated\CommunicationActivityFile\StreamCommunicationActivityFilesRequest;
use App\Grpc\Generated\CommunicationActivityFile\CommunicationActivityFileBatch;

interface CommunicationActivityFileServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.communication_activity_file.CommunicationActivityFileService';

    public function List(ContextInterface $ctx, ListCommunicationActivityFilesRequest $in): ListCommunicationActivityFilesResponse;

    public function Stream(ContextInterface $ctx, StreamCommunicationActivityFilesRequest $in): CommunicationActivityFileBatch;
}
