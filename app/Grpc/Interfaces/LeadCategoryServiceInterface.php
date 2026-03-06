<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\LeadCategory\ListLeadCategoriesRequest;
use App\Grpc\Generated\LeadCategory\ListLeadCategoriesResponse;
use App\Grpc\Generated\LeadCategory\StreamLeadCategoriesRequest;
use App\Grpc\Generated\LeadCategory\LeadCategoryBatch;

interface LeadCategoryServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.lead_category.LeadCategoryService';

    public function List(ContextInterface $ctx, ListLeadCategoriesRequest $in): ListLeadCategoriesResponse;

    public function Stream(ContextInterface $ctx, StreamLeadCategoriesRequest $in): LeadCategoryBatch;
}
