<?php


$addOnOf = 'worksuite-new';
$product = $addOnOf . '-performance-module';

return [
    'name' => 'Performance',
    'verification_required' => true,
    'envato_item_id' => 56487763,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.5.0',
    'script_name' => $product,
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\Performance\Entities\PerformanceGlobalSetting::class,
];
