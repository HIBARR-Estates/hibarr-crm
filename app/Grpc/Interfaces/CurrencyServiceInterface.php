<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\Currency\ListCurrenciesRequest;
use App\Grpc\Generated\Currency\ListCurrenciesResponse;
use App\Grpc\Generated\Currency\StreamCurrenciesRequest;
use App\Grpc\Generated\Currency\CurrencyBatch;

interface CurrencyServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.currency.CurrencyService';

    public function List(ContextInterface $ctx, ListCurrenciesRequest $in): ListCurrenciesResponse;

    public function Stream(ContextInterface $ctx, StreamCurrenciesRequest $in): CurrencyBatch;
}
