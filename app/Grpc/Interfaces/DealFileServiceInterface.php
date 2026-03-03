<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DealFile\ListDealFilesRequest;
use App\Grpc\Generated\DealFile\ListDealFilesResponse;
use App\Grpc\Generated\DealFile\StreamDealFilesRequest;
use App\Grpc\Generated\DealFile\DealFileBatch;

interface DealFileServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.deal_file.DealFileService';

    public function List(ContextInterface $ctx, ListDealFilesRequest $in): ListDealFilesResponse;

    public function Stream(ContextInterface $ctx, StreamDealFilesRequest $in): DealFileBatch;
}
