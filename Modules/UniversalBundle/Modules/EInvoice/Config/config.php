<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'EInvoice',
    'verification_required' => true,
    'envato_item_id' => 49301516,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.3.74',
    'script_name' => $addOnOf.'-einvoice-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\EInvoice\Entities\EInvoiceSetting::class,
];
