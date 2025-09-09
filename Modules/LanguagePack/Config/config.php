<?php

$addOnOf = 'tabletrack';

return [
    'name' => 'LanguagePack',
    'verification_required' => true,
    'envato_item_id' => '',
    'parent_envato_id' => 55116396,
    'parent_min_version' => '1.2.30',
    'script_name' => $addOnOf . '-languagepack-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\LanguagePack\Entities\LanguagePackSetting::class,
];
