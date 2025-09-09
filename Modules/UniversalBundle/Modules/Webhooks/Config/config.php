<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'Webhooks',
    'verification_required' => true,
    'envato_item_id' => 49460575,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.3.74',
    'script_name' => $addOnOf . '-webhooks-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\Webhooks\Entities\WebhooksGlobalSetting::class,
];
