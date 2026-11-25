<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadAssignmentPoolMember extends BaseModel
{
    protected $table = 'lead_assignment_pool_members';

    protected $guarded = ['id'];

    protected $casts = [
        'active' => 'boolean',
        'weight' => 'integer',
    ];

    public function pool(): BelongsTo
    {
        return $this->belongsTo(LeadAssignmentPool::class, 'pool_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
