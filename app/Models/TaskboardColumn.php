<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * App\Models\TaskboardColumn
 *
 * @property int $id
 * @property string $column_name
 * @property string|null $slug
 * @property string $label_color
 * @property int $priority
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read mixed $icon
 * @property-read \Illuminate\Database\Eloquent\Collection|\App\Models\Task[] $tasks
 * @property-read int|null $tasks_count
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn query()
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn whereColumnName($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn whereLabelColor($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn wherePriority($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn whereSlug($value)
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn whereUpdatedAt($value)
 * @property int|null $company_id
 * @property-read \App\Models\Company|null $company
 * @method static \Illuminate\Database\Eloquent\Builder|TaskboardColumn whereCompanyId($value)
 * @mixin \Eloquent
 */
class TaskboardColumn extends BaseModel
{

    use HasCompany;

    protected $fillable = ['column_name', 'slug', 'label_color', 'priority'];

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'board_column_id')->orderBy('column_priority');
    }

    public function membertasks(): HasMany
    {
        return $this->hasMany(Task::class, 'board_column_id')->where('user_id', user()->id)->orderBy('column_priority');
    }

    public function userSetting(): HasOne
    {
        return $this->hasOne(UserTaskboardSetting::class, 'board_column_id')->where('user_id', user()->id);
    }

    /**
     * The board has a handful of columns and every one of the helpers below was
     * its own query, several times per request. Fetch them once and index by slug.
     * Scoped (not static) so it rebuilds per request and per queued job.
     */
    private static function bySlug(string $slug): ?self
    {
        $key = 'taskboard-columns.' . (company()?->id ?? 0);

        if (! app()->bound($key)) {
            app()->scoped($key, fn () => static::query()->get()->keyBy('slug'));
        }

        return app()->make($key)->get($slug);
    }

    /**
     * Get the "Done" column (completed tasks)
     * @return TaskboardColumn|null
     */
    public static function completeColumn()
    {
        return self::bySlug('done');
    }

    /**
     * Alias for completeColumn for new naming convention
     * @return TaskboardColumn|null
     */
    public static function doneColumn()
    {
        return self::completeColumn();
    }

    /**
     * Get the "In Review" column (waiting for approval)
     * @return TaskboardColumn|null
     */
    public static function waitingForApprovalColumn()
    {
        return self::bySlug('in_review');
    }

    /**
     * Alias for waitingForApprovalColumn for new naming convention
     * @return TaskboardColumn|null
     */
    public static function inReviewColumn()
    {
        return self::waitingForApprovalColumn();
    }

    /**
     * Get the "To Do" column
     * @return TaskboardColumn|null
     */
    public static function toDoColumn()
    {
        return self::bySlug('to_do');
    }

    /**
     * Get the "In Progress" column
     * @return TaskboardColumn|null
     */
    public static function inProgressColumn()
    {
        return self::bySlug('in_progress');
    }

    /**
     * Get the "On Hold" column
     * @return TaskboardColumn|null
     */
    public static function onHoldColumn()
    {
        return self::bySlug('on_hold');
    }
}
