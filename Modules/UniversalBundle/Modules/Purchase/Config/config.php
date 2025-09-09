<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'Purchase',
    'verification_required' => true,
    'envato_item_id' => 48911003,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.3.5',
    'script_name' => $addOnOf . '-purchase-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\Purchase\Entities\PurchaseManagementSetting::class,
];
