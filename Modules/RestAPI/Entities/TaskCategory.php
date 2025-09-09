<?php

namespace Modules\RestAPI\Entities;

use App\Observers\TaskCategoryObserver;

class TaskCategory extends \App\Models\TaskCategory
{
    // region Properties

    protected $table = 'task_category';

    protected $default = [
        'id',
        'title',
    ];

    protected $hidden = [
    ];

    protected $guarded = [
        'id',
    ];

    protected $filterable = [
        'id',
        'title',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(TaskCategoryObserver::class);
    }
}
