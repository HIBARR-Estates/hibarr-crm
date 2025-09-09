<?php

namespace Modules\Performance\Entities;

use App\Models\User;
use App\Models\BaseModel;
use App\Scopes\ActiveScope;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Agenda extends BaseModel
{
    use HasFactory;

    protected $table = 'performance_meeting_agenda';

    public function meeting(): BelongsTo
    {
        return $this->belongsTo(Meeting::class, 'meeting_id');
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by')->withoutGlobalScope(ActiveScope::class);
    }

}
