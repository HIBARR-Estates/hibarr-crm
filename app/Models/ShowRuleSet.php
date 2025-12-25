<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShowRuleSet extends Model
{
    protected $fillable = [
        'field_id',
        'default_visibility',
        'enabled',
    ];

    protected $casts = [
        'default_visibility' => 'boolean',
        'enabled' => 'boolean',
    ];

    /**
     * Get the custom field this rule set belongs to
     */
    public function field(): BelongsTo
    {
        return $this->belongsTo(CustomField::class, 'field_id');
    }

    /**
     * Get the rule group for this rule set
     */
    public function group(): HasOne
    {
        return $this->hasOne(ShowRuleGroup::class, 'rule_set_id');
    }

    /**
     * Get all groups (for future multi-group support)
     */
    public function groups(): HasMany
    {
        return $this->hasMany(ShowRuleGroup::class, 'rule_set_id');
    }
}
