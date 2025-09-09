<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'Sms',
    'verification_required' => true,
    'envato_item_id' => 27861914,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.2.3',
    'script_name' => $addOnOf.'-sms-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\Sms\Entities\SmsSetting::class,
];
