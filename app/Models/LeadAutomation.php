<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeadAutomation extends BaseModel
{
    use HasFactory;
    use HasCompany;

    protected $table = 'lead_automations';

    protected $fillable = [
        'company_id',
        'name',
        'trigger',
        'active',
        'priority',
    ];

    protected $casts = [
        'active' => 'boolean',
        'priority' => 'integer',
    ];

    public function conditions(): HasMany
    {
        return $this->hasMany(LeadAutomationCondition::class, 'lead_automation_id');
    }

    public function actions(): HasMany
    {
        return $this->hasMany(LeadAutomationAction::class, 'lead_automation_id')
            ->orderByDesc('priority')
            ->orderBy('id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(LeadAutomationLog::class, 'automation_id');
    }
}
