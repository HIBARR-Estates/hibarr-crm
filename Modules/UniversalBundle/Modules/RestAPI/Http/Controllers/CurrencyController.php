<?php

namespace Modules\RestAPI\Http\Controllers;

use App\Models\Currency;

class CurrencyController extends ApiBaseController
{
    protected $model = Currency::class;
}
