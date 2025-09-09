<?php

namespace Modules\RestAPI\Http\Controllers;

use Modules\RestAPI\Entities\Notice;
use Modules\RestAPI\Http\Requests\Notice\CreateRequest;
use Modules\RestAPI\Http\Requests\Notice\DeleteRequest;
use Modules\RestAPI\Http\Requests\Notice\IndexRequest;
use Modules\RestAPI\Http\Requests\Notice\ShowRequest;
use Modules\RestAPI\Http\Requests\Notice\UpdateRequest;

class NoticeController extends ApiBaseController
{
    protected $model = Notice::class;

    protected $indexRequest = IndexRequest::class;

    protected $storeRequest = CreateRequest::class;

    protected $updateRequest = UpdateRequest::class;

    protected $showRequest = ShowRequest::class;

    protected $deleteRequest = DeleteRequest::class;

    public function modifyIndex($query)
    {
        return $query->visibility();
    }
}
