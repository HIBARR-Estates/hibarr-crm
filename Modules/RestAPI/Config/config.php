<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'RestAPI',
    'verification_required' => true,
    'envato_item_id' => 25683880,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.2.3',
    'script_name' => $addOnOf . '-restapi-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\RestAPI\Entities\RestAPISetting::class,
    'jwt_secret' => '2dSW430D2ZfLwO1TjO03Q25S7mII5StAgvdCcxU8GMqgykjS1d3i2r2bLT5bvIFT',
    'debug' => config('app.api_debug', false),
];
