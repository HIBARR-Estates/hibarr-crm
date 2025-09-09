<?php

namespace Modules\RestAPI\Http\Controllers;

use Modules\RestAPI\Entities\LeaveType;
use Modules\RestAPI\Http\Requests\LeaveType\IndexRequest;

class LeaveTypeController extends ApiBaseController
{
    protected $model = LeaveType::class;

    protected $indexRequest = IndexRequest::class;

    public function modifyIndex($query)
    {
        return $query->visibility();
    }
}
