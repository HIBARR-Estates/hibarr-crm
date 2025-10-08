<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * App\Models\MeetingType
 *
 * @property int $id
 * @property string $name
 * @property string $description
 * @property string $color
 * @property int|null $company_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Company|null $company
 * @property-read \Illuminate\Database\Eloquent\Collection|\App\Models\DealFollowUp[] $followUps
 * @property-read int|null $follow_ups_count
 */
class MeetingType extends BaseModel
{
    use HasCompany;

    protected $fillable = [
        'name',
        'description',
        'color',
        'company_id'
    ];

    /**
     * Get the follow-ups for this meeting type
     */
    public function followUps(): HasMany
    {
        return $this->hasMany(DealFollowUp::class, 'meeting_type_id');
    }

    /**
     * Get the display name with color
     */
    public function getDisplayNameAttribute(): string
    {
        return $this->name;
    }
}
