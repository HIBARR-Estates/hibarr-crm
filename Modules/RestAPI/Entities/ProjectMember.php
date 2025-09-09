<?php

namespace Modules\RestAPI\Entities;

use App\Models\BaseModel;
use App\Models\User;
use App\Observers\ProjectMemberObserver;
use App\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectMember extends BaseModel
{
    protected $fillable = ['user_id', 'project_id'];

    protected $default = ['user_id', 'project_id'];

    protected $guarded = ['id'];

    protected $filterable = ['user_id', 'project_id'];

    public static function boot()
    {
        parent::boot();
        static::observe(ProjectMemberObserver::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id')->withoutGlobalScope(ActiveScope::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'user_id')->withoutGlobalScope(ActiveScope::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public static function byProject($id)
    {
        return ProjectMember::join('users', 'users.id', '=', 'project_members.user_id')
            ->where('project_members.project_id', $id)
            ->where('users.status', 'active')
            ->get();
    }

    public static function checkIsMember($projectId, $userId)
    {
        return ProjectMember::where('project_id', $projectId)
            ->where('user_id', $userId)->first();
    }
}
