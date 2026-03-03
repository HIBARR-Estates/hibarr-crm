<?php

namespace App\Grpc\Interfaces;

use Spiral\RoadRunner\GRPC\ContextInterface;
use Spiral\RoadRunner\GRPC\ServiceInterface;
use App\Grpc\Generated\DealNote\ListDealNotesRequest;
use App\Grpc\Generated\DealNote\ListDealNotesResponse;
use App\Grpc\Generated\DealNote\StreamDealNotesRequest;
use App\Grpc\Generated\DealNote\DealNoteBatch;

interface DealNoteServiceInterface extends ServiceInterface
{
    public const NAME = 'hibarr.crm.deal_note.DealNoteService';

    public function List(ContextInterface $ctx, ListDealNotesRequest $in): ListDealNotesResponse;

    public function Stream(ContextInterface $ctx, StreamDealNotesRequest $in): DealNoteBatch;
}
