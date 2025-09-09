<?php

namespace Modules\RestAPI\Entities;

use App\Observers\TaskBoardColumnObserver;

class TaskboardColumn extends \App\Models\TaskboardColumn
{
    // region Properties

    protected $table = 'taskboard_columns';

    protected $default = [
        'id',
        'column_name',
        'slug',
        'label_color',
        'priority',
    ];

    protected $hidden = [
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'column_name',
        'slug',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(TaskBoardColumnObserver::class);
    }
}
