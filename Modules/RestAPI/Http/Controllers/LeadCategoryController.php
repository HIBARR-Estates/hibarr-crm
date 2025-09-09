<?php

namespace Modules\RestAPI\Http\Controllers;

use Modules\RestAPI\Entities\LeadCategory;
use Modules\RestAPI\Http\Requests\LeadCategory\CreateRequest;
use Modules\RestAPI\Http\Requests\LeadCategory\DeleteRequest;
use Modules\RestAPI\Http\Requests\LeadCategory\IndexRequest;
use Modules\RestAPI\Http\Requests\LeadCategory\ShowRequest;
use Modules\RestAPI\Http\Requests\LeadCategory\UpdateRequest;

class LeadCategoryController extends ApiBaseController
{
    protected $model = LeadCategory::class;

    protected $indexRequest = IndexRequest::class;

    protected $storeRequest = CreateRequest::class;

    protected $updateRequest = UpdateRequest::class;

    protected $showRequest = ShowRequest::class;

    protected $deleteRequest = DeleteRequest::class;
}
