<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\Lead\CreateLeadRequest;
use App\Grpc\Generated\Lead\GetLeadRequest;
use App\Grpc\Generated\Lead\UpdateLeadRequest;
use App\Grpc\Generated\Lead\DeleteLeadRequest;
use App\Grpc\Generated\Lead\ListLeadsRequest;
use App\Grpc\Generated\Lead\ListLeadsResponse;
use App\Grpc\Generated\Lead\LeadResponse;
use App\Grpc\Generated\Common\PBEmpty;

interface LeadServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.lead.LeadService';

    public function Create(ContextInterface $ctx, CreateLeadRequest $in): LeadResponse;

    public function Get(ContextInterface $ctx, GetLeadRequest $in): LeadResponse;

    public function Update(ContextInterface $ctx, UpdateLeadRequest $in): LeadResponse;

    public function Delete(ContextInterface $ctx, DeleteLeadRequest $in): PBEmpty;

    public function List(ContextInterface $ctx, ListLeadsRequest $in): ListLeadsResponse;
}
