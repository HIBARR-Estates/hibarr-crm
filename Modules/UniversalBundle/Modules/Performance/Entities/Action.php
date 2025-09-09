<?php

namespace Modules\Performance\Entities;

use App\Models\BaseModel;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Action extends BaseModel
{
    use HasFactory;

    protected $table = 'performance_meeting_actions';

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class, 'meeting_id');
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by')->withoutGlobalScope(ActiveScope::class);
    }

}
