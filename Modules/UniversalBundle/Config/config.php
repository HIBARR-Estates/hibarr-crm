<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'UniversalBundle',
    'verification_required' => true,
    'envato_item_id' => 48913708,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.3.6',
    'script_name' => $addOnOf.'-universalbundle-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\UniversalBundle\Entities\UniversalBundleSetting::class,
];
