<?php

namespace Modules\RestAPI\Entities;

use App\Observers\SubTaskObserver;

class SubTask extends \App\Models\SubTask
{
    // region Properties

    protected $table = 'sub_tasks';

    protected $default = [
        'id',
        'title',
        'due_date',
        'status',
    ];

    protected $hidden = [
    ];

    protected $guarded = [
        'id',
        'task_id',
    ];

    protected $filterable = [
        'id',
        'title',
        'status',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(SubTaskObserver::class);
    }
}
