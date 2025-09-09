<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'Zoom',
    'verification_required' => true,
    'envato_item_id' => 29195805,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.2.3',
    'script_name' => $addOnOf.'-zoom-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\Zoom\Entities\ZoomGlobalSetting::class,
];
