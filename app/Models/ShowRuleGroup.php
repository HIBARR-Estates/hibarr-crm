<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShowRuleGroup extends Model
{
    protected $fillable = [
        'rule_set_id',
        'group_operator',
    ];

    /**
     * Get the rule set this group belongs to
     */
    public function ruleSet(): BelongsTo
    {
        return $this->belongsTo(ShowRuleSet::class, 'rule_set_id');
    }

    /**
     * Get all criteria for this group
     */
    public function criteria(): HasMany
    {
        return $this->hasMany(ShowCriterion::class, 'group_id')->orderBy('id');
    }
}
