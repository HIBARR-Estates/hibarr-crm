<?php

namespace Modules\RestAPI\Http\Controllers;

use Modules\RestAPI\Entities\ContractType;
use Modules\RestAPI\Http\Requests\ContractType\CreateRequest;
use Modules\RestAPI\Http\Requests\ContractType\DeleteRequest;
use Modules\RestAPI\Http\Requests\ContractType\IndexRequest;
use Modules\RestAPI\Http\Requests\ContractType\ShowRequest;
use Modules\RestAPI\Http\Requests\ContractType\UpdateRequest;

class ContractTypeController extends ApiBaseController
{
    protected $model = ContractType::class;

    protected $indexRequest = IndexRequest::class;

    protected $storeRequest = CreateRequest::class;

    protected $updateRequest = UpdateRequest::class;

    protected $showRequest = ShowRequest::class;

    protected $deleteRequest = DeleteRequest::class;
}
