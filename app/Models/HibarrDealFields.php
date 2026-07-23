<?php

namespace App\Models;

use App\Services\FileStorageService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HibarrDealFields extends Model
{
    protected $table = 'hibarr_deal_custom_fields';
    protected $fillable = 
    [
        'deal_id',
        'interested_in',
        'motivation',
        'purchase_timeline',
        'budget_range',
        'message',
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

    protected $appends = [
        'deposit_confirmation_url',
        'reservation_agreement_url',
        'sales_contract_url',
    ];

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'deal_id');
    }

    // ========================================================================
    // Dual-support URL accessors for document columns
    // If the stored value is already an external URL, return it directly.
    // Otherwise, resolve via the legacy local/S3 path.
    // ========================================================================

    public function getDepositConfirmationUrlAttribute(): ?string
    {
        return $this->resolveFileUrl($this->deposit_confirmation);
    }

    public function getReservationAgreementUrlAttribute(): ?string
    {
        return $this->resolveFileUrl($this->reservation_agreement);
    }

    public function getSalesContractUrlAttribute(): ?string
    {
        return $this->resolveFileUrl($this->sales_contract);
    }

    /**
     * Resolve a file column value to a full URL.
     * External URLs are returned as-is; local filenames go through asset_url_local_s3.
     */
    protected function resolveFileUrl(?string $value): ?string
    {
        if (empty($value)) {
            return null;
        }

        if (FileStorageService::isExternalUrl($value)) {
            return $value;
        }

        // Legacy local/S3 fallback — hibarr documents are stored under
        // hibarr_fields/, not custom_fields/ (see DealGatheringService::deleteHibarrFieldFile()).
        return asset_url_local_s3('hibarr_fields/' . $value);
    }
}