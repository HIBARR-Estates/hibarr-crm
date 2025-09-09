<?php

namespace Modules\RestAPI\Http\Controllers;

use Modules\RestAPI\Entities\Product;
use Modules\RestAPI\Http\Requests\Product\CreateRequest;
use Modules\RestAPI\Http\Requests\Product\DeleteRequest;
use Modules\RestAPI\Http\Requests\Product\IndexRequest;
use Modules\RestAPI\Http\Requests\Product\ShowRequest;
use Modules\RestAPI\Http\Requests\Product\UpdateRequest;

class ProductController extends ApiBaseController
{
    protected $model = Product::class;

    protected $indexRequest = IndexRequest::class;

    protected $storeRequest = CreateRequest::class;

    protected $updateRequest = UpdateRequest::class;

    protected $showRequest = ShowRequest::class;

    protected $deleteRequest = DeleteRequest::class;
}
