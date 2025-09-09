<?php

$addOnOf = 'worksuite-new';
$product = $addOnOf . '-cybersecurity-module';

return [
    'name' => 'CyberSecurity',
    'verification_required' => true,
    'envato_item_id' => 50108115,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.3.8',
    'script_name' => $product,
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\CyberSecurity\Entities\CyberSecuritySetting::class,
];
