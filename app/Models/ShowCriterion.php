<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShowCriterion extends Model
{
    protected $fillable = [
        'group_id',
        'reference_source',
        'reference_field_id',
        'operator',
        'reference_value',
        'negate',
    ];

    protected $casts = [
        'negate' => 'boolean',
    ];

    /**
     * Get the rule group this criterion belongs to
     */
    public function group(): BelongsTo
    {
        return $this->belongsTo(ShowRuleGroup::class, 'group_id');
    }

    /**
     * Get the reference field being evaluated
     */
    public function referenceField(): BelongsTo
    {
        return $this->belongsTo(CustomField::class, 'reference_field_id');
    }
}
