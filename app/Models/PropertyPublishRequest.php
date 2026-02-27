<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * PropertyPublishRequest — tracks requests from agents to publish a property.
 *
 * Only Sales Managers (admin) can approve/reject. Non-admin users must go
 * through this workflow instead of publishing directly.
 *
 * @property int         $id
 * @property int         $property_id
 * @property int         $requesting_agent_id
 * @property int         $company_id
 * @property string      $status               pending|approved|rejected
 * @property string|null $message               Agent's note to SM
 * @property string|null $response_message      SM's reply
 * @property int|null    $reviewed_by           User ID of the SM who acted
 * @property \Carbon\Carbon|null $reviewed_at
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property \Carbon\Carbon|null $deleted_at
 */
class PropertyPublishRequest extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    // Status constants
    const STATUS_PENDING  = 'pending';
    const STATUS_APPROVED = 'approved';
    const STATUS_REJECTED = 'rejected';

    const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_REJECTED,
    ];

    protected $table = 'property_publish_requests';

    protected $fillable = [
        'property_id',
        'requesting_agent_id',
        'company_id',
        'status',
        'message',
        'response_message',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    protected $hidden = ['pivot'];

    // ================================================================
    // Relationships
    // ================================================================

    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function requestingAgent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requesting_agent_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    // ================================================================
    // Scopes
    // ================================================================

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeForProperty($query, int $propertyId)
    {
        return $query->where('property_id', $propertyId);
    }

    public function scopeForAgent($query, int $userId)
    {
        return $query->where('requesting_agent_id', $userId);
    }

    // ================================================================
    // Helper Methods
    // ================================================================

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    public function isRejected(): bool
    {
        return $this->status === self::STATUS_REJECTED;
    }

    /**
     * Check if a user has admin/SM-level property permissions.
     */
    public static function isUserAdmin(User $user): bool
    {
        $permission = $user->permission('edit_products');
        return $permission === 'all' || $permission === 4;
    }
}
