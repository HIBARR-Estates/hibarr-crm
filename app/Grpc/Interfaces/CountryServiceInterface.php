<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\Country\ListCountriesRequest;
use App\Grpc\Generated\Country\ListCountriesResponse;
use App\Grpc\Generated\Country\StreamCountriesRequest;
use App\Grpc\Generated\Country\CountryBatch;

interface CountryServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.country.CountryService';

    public function List(ContextInterface $ctx, ListCountriesRequest $in): ListCountriesResponse;

    public function Stream(ContextInterface $ctx, StreamCountriesRequest $in): CountryBatch;
}
