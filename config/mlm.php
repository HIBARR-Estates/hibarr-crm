<?php

return [

    /*
    |--------------------------------------------------------------------------
    | MLM Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for the Multi-Level Marketing (MLM) commission engine.
    |
    */

    /*
    | Default maximum commission percentage per deal.
    | Can be overridden per-deal via the max_commission_percentage column.
    */
    'max_commission_percentage' => env('MLM_MAX_COMMISSION_PCT', 10),

    /*
    | Whether to automatically re-evaluate ancestor levels when a
    | downline deal is won (their NSD/VSD metrics changed).
    */
    'auto_evaluate_ancestors' => env('MLM_AUTO_EVALUATE_ANCESTORS', true),

    /*
    | Queue connection for MLM processing jobs.
    */
    'queue_connection' => env('MLM_QUEUE', 'default'),

];
