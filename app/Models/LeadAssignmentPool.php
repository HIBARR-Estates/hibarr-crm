<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeadAssignmentPool extends BaseModel
{
    use HasCompany;

    public const STRATEGY_ROUND_ROBIN = 'round_robin';

    protected $table = 'lead_assignment_pools';

    protected $guarded = ['id'];

    protected $casts = [
        'active' => 'boolean',
    ];

    public function members(): HasMany
    {
        return $this->hasMany(LeadAssignmentPoolMember::class, 'pool_id')->orderBy('id');
    }
}
