<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Services\Qualification\QualificationActionCatalog;

class QualificationActionCatalogController extends Controller
{
    public function index(QualificationActionCatalog $catalog)
    {
        return Reply::dataOnly($catalog->toArray());
    }
}
