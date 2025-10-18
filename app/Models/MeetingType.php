<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MeetingType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'color',
        'company_id',
    ];

    public function meetingSummaries(): HasMany
    {
        return $this->hasMany(MeetingSummary::class, 'meeting_type_id');
    }
}
