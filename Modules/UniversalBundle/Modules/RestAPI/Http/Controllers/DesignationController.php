<?php

namespace Modules\RestAPI\Http\Controllers;

use Modules\RestAPI\Entities\Designation;
use Modules\RestAPI\Http\Requests\Designation\CreateRequest;
use Modules\RestAPI\Http\Requests\Designation\DeleteRequest;
use Modules\RestAPI\Http\Requests\Designation\IndexRequest;
use Modules\RestAPI\Http\Requests\Designation\ShowRequest;
use Modules\RestAPI\Http\Requests\Designation\UpdateRequest;

class DesignationController extends ApiBaseController
{
    protected $model = Designation::class;

    protected $indexRequest = IndexRequest::class;

    protected $storeRequest = CreateRequest::class;

    protected $updateRequest = UpdateRequest::class;

    protected $showRequest = ShowRequest::class;

    protected $deleteRequest = DeleteRequest::class;
}
