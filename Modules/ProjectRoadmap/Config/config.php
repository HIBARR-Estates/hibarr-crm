<?php

$addOnOf = 'worksuite-new';

return [
    'name' => 'ProjectRoadmap',
    'verification_required' => true,
    'envato_item_id' => 49417200,
    'parent_envato_id' => 20052522,
    'parent_min_version' => '5.3.74',
    'script_name' => $addOnOf . '-projectroadmap-module',
    'parent_product_name' => $addOnOf,
    'setting' => \Modules\ProjectRoadmap\Entities\ProjectRoadmapSetting::class,
];
