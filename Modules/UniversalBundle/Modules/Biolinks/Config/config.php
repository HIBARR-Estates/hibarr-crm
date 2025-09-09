<?php

$addOnOf = 'worksuite-new';
$product = $addOnOf . '-biolinks-module';

return [
    'name' => 'Biolinks',
    'verification_required' => true,
    'envato_item_id' => 52371525,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.4.1',
    'script_name' => $product,
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\Biolinks\Entities\BiolinksGlobalSetting::class,
];
