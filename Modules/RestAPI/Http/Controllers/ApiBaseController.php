<?php

namespace Modules\RestAPI\Http\Controllers;

use Froiden\RestAPI\ApiController;
use Illuminate\Support\Facades\App;

class ApiBaseController extends ApiController
{

    public function __construct()
    {
        parent::__construct();

        $userLocale = 'en';

        config(['auth.defaults.guard' => 'api']);

        $user = api_user();

        if ($user) {
            $userLocale = $user->locale ?? 'en';
        }

        App::setLocale($userLocale);
        // SET default guard to api
        // auth('api')->user will be accessed as auth()->user();

    }
}
