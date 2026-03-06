<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * App\Models\Taskable
 *
 * @property int $id
 * @property int $task_id
 * @property int $taskable_id
 * @property string $taskable_type
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Task $task
 * @method static \Illuminate\Database\Eloquent\Builder|Taskable newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|Taskable newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|Taskable query()
 * @method static \Illuminate\Database\Eloquent\Builder|Taskable whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Taskable whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Taskable whereTaskId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Taskable whereTaskableId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Taskable whereTaskableType($value)
 * @method static \Illuminate\Database\Eloquent\Builder|Taskable whereUpdatedAt($value)
 * @mixin \Eloquent
 */
class Taskable extends Model
{
    protected $table = 'taskables';

    protected $fillable = [
        'task_id',
        'taskable_id',
        'taskable_type',
    ];

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }
}
