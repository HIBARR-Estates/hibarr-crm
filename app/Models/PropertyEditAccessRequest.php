<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PropertyEditAccessRequest extends BaseModel
{
    use HasFactory, HasCompany, SoftDeletes;

    const STATUS_PENDING = 'pending';
    const STATUS_APPROVED = 'approved';
    const STATUS_DENIED = 'denied';

    const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_DENIED,
    ];

    protected $table = 'property_edit_access_requests';

    protected $fillable = [
        'property_id',
        'requesting_agent_id',
        'responsible_agent_id',
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

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

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
        return $query->where(function ($q) use ($userId) {
            $q->where('requesting_agent_id', $userId)
                ->orWhere('responsible_agent_id', $userId);
        });
    }

    public function isPending(): bool
    {
        return $this->status === self::STATUS_PENDING;
    }

    public function isResolved(): bool
    {
        return in_array($this->status, [self::STATUS_APPROVED, self::STATUS_DENIED], true);
    }

    public function canBeRespondedBy(User $user): bool
    {
        if (!$this->isPending()) {
            return false;
        }

        if ($user->id === $this->responsible_agent_id) {
            return true;
        }

        return self::isUserAdmin($user);
    }

    public function canBeViewedBy(User $user): bool
    {
        if ($user->id === $this->requesting_agent_id || $user->id === $this->responsible_agent_id) {
            return true;
        }

        return self::isUserAdmin($user);
    }

    public static function isUserAdmin(User $user): bool
    {
        return \App\Support\PermissionGates::canManageProperties($user);
    }
}
