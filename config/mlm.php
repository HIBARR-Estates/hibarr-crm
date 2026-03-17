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

    /*
    |--------------------------------------------------------------------------
    | Cycle Configuration Defaults
    |--------------------------------------------------------------------------
    |
    | Default settings for new cycle configurations.
    | These are used when creating a cycle config without explicit values.
    |
    */
    'cycle' => [
        /*
        | Default cycle duration type: monthly, quarterly, custom.
        */
        'default_duration_type' => env('MLM_CYCLE_DURATION_TYPE', 'monthly'),

        /*
        | Default max overflow multiplier.
        | Overflow duration = cycle_duration × this multiplier.
        | 1.0 means the agent gets the same amount of time as the cycle duration.
        */
        'default_max_overflow_multiplier' => env('MLM_CYCLE_MAX_OVERFLOW_MULTIPLIER', 1.0),

        /*
        | Whether to auto-generate the next cycle when the current one ends.
        */
        'auto_generate' => env('MLM_CYCLE_AUTO_GENERATE', true),
    ],

];
