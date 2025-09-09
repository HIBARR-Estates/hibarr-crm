<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'Letter',
    'verification_required' => true,
    'envato_item_id' => 50767300,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.3.81',
    'script_name' => $addOnOf.'-letter-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\Letter\Entities\LetterSetting::class,
];
