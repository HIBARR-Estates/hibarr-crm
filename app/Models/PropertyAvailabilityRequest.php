<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PropertyAvailabilityRequest extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    // Status constants
    const STATUS_PENDING = 'pending';
    const STATUS_APPROVED = 'approved';
    const STATUS_DENIED = 'denied';
    const STATUS_ESCALATED = 'escalated';
    const STATUS_EXPIRED = 'expired';

    const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_DENIED,
        self::STATUS_ESCALATED,
        self::STATUS_EXPIRED,
    ];

    // Business hours before escalation
    const ESCALATION_BUSINESS_HOURS = 8;

    protected $table = 'property_availability_requests';

    protected $fillable = [
        'property_id',
        'requesting_agent_id',
        'responsible_agent_id',
        'company_id',
        'status',
        'message',
        'response_message',
        'responded_at',
        'escalated_at',
        'escalated_to_id',
        'expires_at',
    ];

    protected $casts = [
        'responded_at' => 'datetime',
        'escalated_at' => 'datetime',
        'expires_at' => 'datetime',
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

    public function responsibleAgent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_agent_id');
    }

    public function escalatedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'escalated_to_id');
    }

    // ================================================================
    // Scopes
    // ================================================================

    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeEscalated($query)
    {
        return $query->where('status', self::STATUS_ESCALATED);
    }

    public function scopeActive($query)
    {
        return $query->whereIn('status', [self::STATUS_PENDING, self::STATUS_ESCALATED]);
    }

    public function scopeOverdue($query)
    {
        return $query->where('status', self::STATUS_PENDING)
            ->where('expires_at', '<=', now());
    }

    public function scopeForProperty($query, int $propertyId)
    {
        return $query->where('property_id', $propertyId);
    }

    public function scopeForAgent($query, int $userId)
    {
        return $query->where(function ($q) use ($userId) {
            $q->where('requesting_agent_id', $userId)
                ->orWhere('responsible_agent_id', $userId);
        });
    }

    // ================================================================
    // Helper Methods
    // ================================================================

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isEscalated(): bool
    {
        return $this->status === self::STATUS_ESCALATED;
    }

    public function isActive(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_ESCALATED]);
    }

    public function isResolved(): bool
    {
        return in_array($this->status, [self::STATUS_APPROVED, self::STATUS_DENIED, self::STATUS_EXPIRED]);
    }

    public function canBeRespondedBy(User $user): bool
    {
        if (!$this->isActive()) {
            return false;
        }

        // Responsible agent can always respond
        if ($user->id === $this->responsible_agent_id) {
            return true;
        }

        // Admins can respond after escalation
        if ($this->isEscalated() && $this->isUserAdmin($user)) {
            return true;
        }

        return false;
    }

    /**
     * Check if a user has admin-level property permissions.
     */
    public function isUserAdmin(User $user): bool
    {
        return \App\Support\PermissionGates::canManageProperties($user);
    }

    /**
     * Check if the user can view this request (admin, sales manager, legal, or involved agent).
     */
    public function canBeViewedBy(User $user): bool
    {
        // Involved agents can always view
        if ($user->id === $this->requesting_agent_id || $user->id === $this->responsible_agent_id) {
            return true;
        }

        // Admin, sales manager, legal can view
        if ($this->isUserAdmin($user)) {
            return true;
        }

        // Check for sales_manager or legal roles
        if ($user->roles()->whereIn('name', ['sales_manager', 'legal'])->exists()) {
            return true;
        }

        return false;
    }

    /**
     * Calculate the expiration datetime (8 business hours from now).
     * Business hours: Mon-Fri 9:00-18:00 (9 hours/day).
     */
    public static function calculateExpiresAt(): \Carbon\Carbon
    {
        $hoursRemaining = self::ESCALATION_BUSINESS_HOURS;
        $current = now();

        while ($hoursRemaining > 0) {
            // Skip weekends
            if ($current->isWeekend()) {
                $current = $current->next(\Carbon\Carbon::MONDAY)->setTime(9, 0);
                continue;
            }

            $businessStart = $current->copy()->setTime(9, 0);
            $businessEnd = $current->copy()->setTime(18, 0);

            // If before business hours, move to start
            if ($current->lt($businessStart)) {
                $current = $businessStart;
            }

            // If after business hours, move to next business day
            if ($current->gte($businessEnd)) {
                $current = $current->addDay()->setTime(9, 0);

                // Skip weekends
                if ($current->isWeekend()) {
                    $current = $current->next(\Carbon\Carbon::MONDAY)->setTime(9, 0);
                }

                continue;
            }

            // Calculate available hours today
            $availableToday = $businessEnd->floatDiffInHours($current);

            if ($availableToday >= $hoursRemaining) {
                $current = $current->addHours($hoursRemaining);
                $hoursRemaining = 0;
            } else {
                $hoursRemaining -= $availableToday;
                $current = $current->addDay()->setTime(9, 0);

                // Skip weekends
                if ($current->isWeekend()) {
                    $current = $current->next(\Carbon\Carbon::MONDAY)->setTime(9, 0);
                }
            }
        }

        return $current;
    }
}
