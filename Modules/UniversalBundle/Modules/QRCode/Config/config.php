<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'QRCode',
    'verification_required' => true,
    'envato_item_id' => 50328620,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.3.8',
    'script_name' => $addOnOf.'-qrcode-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\QRCode\Entities\QRCodeSetting::class,
];
