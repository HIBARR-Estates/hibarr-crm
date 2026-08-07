<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadFlightItinerary extends Model
{
    use HasFactory;

    protected $fillable = [
        'lead_id',
        'deal_id',
        'direction',
        'airport_name',
        'flight_number',
        'flight_date',
        'status',
        'is_transfer_required',
        'ticket_image_url',
        'remind_at',
        'reminders',
    ];

    protected $casts = [
        'flight_date' => 'datetime',
        'is_transfer_required' => 'boolean',
        'remind_at' => 'datetime',
        'reminders' => 'array',
    ];

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class);
    }
}
