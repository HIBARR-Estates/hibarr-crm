<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HibarrDealFields extends Model
{
    protected $table = 'hibarr_deal_custom_fields';
    protected $fillable = 
    [
        'deal_id',
        'interested_in',
        'motivation/comment',
        'purchase_timeline',
        'budget_range',
        'strategy_meeting_booked',
        'downpayment_paid',
        'inspection_trip_date',
        'deposit_confirmation',
        'reservation_agreement',
        'sales_contract'
    ];

    protected $casts = [
        'strategy_meeting_booked' => 'boolean',
        'downpayment_paid' => 'boolean',
        'inspection_trip_date' => 'date',
    ];

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'deal_id');
    }
}