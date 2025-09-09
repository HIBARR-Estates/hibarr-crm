<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;
use App\Models\User;
use App\Scopes\ActiveScope;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Meeting extends BaseModel
{
    use HasCompany;

    protected $table = 'performance_meetings';

    protected $dates = ['start_date_time', 'end_date_time', 'created_at', 'updated_at'];

    public function agendas(): HasMany
    {
        return $this->hasMany(Agenda::class, 'meeting_id', 'id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(Action::class, 'meeting_id', 'id');
    }

    public function meetingFor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'meeting_for')->withoutGlobalScope(ActiveScope::class);
    }

    public function meetingBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'meeting_by')->withoutGlobalScope(ActiveScope::class);
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by')->withoutGlobalScope(ActiveScope::class);
    }

    public function goal(): BelongsTo
    {
        return $this->belongsTo(Objective::class, 'objective_id');
    }

}
