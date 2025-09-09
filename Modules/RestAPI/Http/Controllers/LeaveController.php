<?php

namespace Modules\RestAPI\Http\Controllers;

use Modules\RestAPI\Entities\Leave;
use Modules\RestAPI\Http\Requests\Leave\CreateRequest;
use Modules\RestAPI\Http\Requests\Leave\DeleteRequest;
use Modules\RestAPI\Http\Requests\Leave\IndexRequest;
use Modules\RestAPI\Http\Requests\Leave\ShowRequest;
use Modules\RestAPI\Http\Requests\Leave\UpdateRequest;

class LeaveController extends ApiBaseController
{
    protected $model = Leave::class;

    protected $indexRequest = IndexRequest::class;

    protected $storeRequest = CreateRequest::class;

    protected $updateRequest = UpdateRequest::class;

    protected $showRequest = ShowRequest::class;

    protected $deleteRequest = DeleteRequest::class;

    public function modifyIndex($query)
    {
        return $query->visibility()
            ->join(
                \DB::raw('(SELECT `id` as `a_user_id`, `name` as `employee_name` FROM `users`) as `a`'),
                'a.a_user_id',
                '=',
                'leaves.user_id'
            );
    }
}
