<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\HibarrDealFields\ListHibarrDealFieldsRequest;
use App\Grpc\Generated\HibarrDealFields\ListHibarrDealFieldsResponse;
use App\Grpc\Generated\HibarrDealFields\StreamHibarrDealFieldsRequest;
use App\Grpc\Generated\HibarrDealFields\HibarrDealFieldsBatch;

interface HibarrDealFieldsServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.hibarr_deal_fields.HibarrDealFieldsService';

    public function List(ContextInterface $ctx, ListHibarrDealFieldsRequest $in): ListHibarrDealFieldsResponse;

    public function Stream(ContextInterface $ctx, StreamHibarrDealFieldsRequest $in): HibarrDealFieldsBatch;
}
