<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'Recruit',
    'verification_required' => true,
    'envato_item_id' => 38316189,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.2.3',
    'script_name' => $addOnOf.'-recruit-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\Recruit\Entities\RecruitGlobalSetting::class,
];
