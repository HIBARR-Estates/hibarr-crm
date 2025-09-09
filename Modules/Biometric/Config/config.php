<?php

$addOnOf = 'worksuite-new';
$product = $addOnOf . '-biometric-module';

return [
    'name' => 'Biometric',
    'verification_required' => true,
    'envato_item_id' => 58274317,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.2.3',
    'script_name' => $product,
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\Biometric\Entities\BiometricGlobalSetting::class,
];
