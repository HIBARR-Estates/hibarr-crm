<?php

namespace Modules\RestAPI\Http\Controllers;

use Modules\RestAPI\Entities\TaskboardColumn;
use Modules\RestAPI\Http\Requests\TaskboardColumn\CreateRequest;
use Modules\RestAPI\Http\Requests\TaskboardColumn\DeleteRequest;
use Modules\RestAPI\Http\Requests\TaskboardColumn\IndexRequest;
use Modules\RestAPI\Http\Requests\TaskboardColumn\ShowRequest;
use Modules\RestAPI\Http\Requests\TaskboardColumn\UpdateRequest;

class TaskboardColumnController extends ApiBaseController
{
    protected $model = TaskboardColumn::class;

    protected $indexRequest = IndexRequest::class;

    protected $storeRequest = CreateRequest::class;

    protected $updateRequest = UpdateRequest::class;

    protected $showRequest = ShowRequest::class;

    protected $deleteRequest = DeleteRequest::class;
}
