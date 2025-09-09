<?php

namespace Modules\RestAPI\Entities;

use App\Models\Payment;
use App\Models\User;
use App\Observers\ProjectObserver;
use App\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends \App\Models\Project
{
    protected $default = [
        'id',
        'project_name',
        'start_date',
        'deadline',
        'status',
        'client_id',
        'company_id',
    ];

    protected $dates = [
        'start_date',
        'deadline',
    ];

    protected $hidden = [
        'created_at',
        'updated_at',
        'category_id',
        'client_id',
    ];

    protected $guarded = [
        'id',
        'created_at',
        'updated_at',
        'category_id',
        'hours_logged',
    ];

    protected $filterable = [
        'id',
        'project_name',
        'start_date',
        'deadline',
        'status',
        'client_id',
        'category_id',
        'project_member_id',
    ];

    protected $appends = [
        'isProjectAdmin',
        'hours_logged',
        'total_earnings',
    ];

    public static function boot()
    {
        parent::boot();
        static::observe(ProjectObserver::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'project_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id')->withoutGlobalScope(ActiveScope::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(ProjectMember::class, 'project_id');
    }

    //phpcs:ignore
    public function members_many(): HasMany
    {
        return $this->hasMany(User::class, 'project_members');
    }

    public function visibleTo(User $user)
    {
        if ($user->hasRole('admin') || ($user->user_other_role !== 'employee' && $user->cans('view_projects'))) {
            return true;
        }

        return in_array($user->id, $this->members->pluck('user_id')->all());
    }

    public function scopeVisibility($query)
    {
        if (api_user()) {
            $user = api_user();

            if ($user->hasRole('admin') || ($user->user_other_role !== 'employee' && $user->cans('view_projects'))) {
                return $query;
            }

            if ($user->hasRole('client')) {
                $query->where('projects.client_id', $user->id);

            } else {
                // If employee or client show projects assigned.
                $query->whereIn(
                    'projects.id',
                    function ($query) use ($user) {
                        $query->select(\DB::raw('DISTINCT(`projects`.`id`)'))
                            ->from('projects')
                            ->join('project_members', 'project_members.project_id', '=', 'projects.id')
                            ->where('project_members.user_id', $user->id);
                    }
                );

                return $query;
            }

            return $query;
        }
    }

    public function getHoursLoggedAttribute()
    {
        $totalMinutes = $this->times()->sum('total_minutes');

        return intdiv($totalMinutes, 60);
    }

    public function getTotalEarningsAttribute()
    {
        return Payment::where('status', 'complete')->where('project_id', $this->id)->sum('amount');
    }

    public function getIsProjectAdminAttribute()
    {
        if (api_user() && $this->project_admin == api_user()->id) {
            return true;
        }

        return false;
    }
}
