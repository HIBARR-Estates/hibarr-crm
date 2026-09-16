<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Notifications\Notifiable;

/**
 * App\Models\UserInvitation
 *
 * @property int $id
 * @property int $user_id
 * @property string $invitation_type
 * @property string|null $email
 * @property string $invitation_code
 * @property string $status
 * @property string|null $email_restriction
 * @property string|null $message
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \Illuminate\Notifications\DatabaseNotificationCollection|\Illuminate\Notifications\DatabaseNotification[] $notifications
 * @property-read int|null $notifications_count
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation query()
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereEmail($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereEmailRestriction($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereInvitationCode($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereInvitationType($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereMessage($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereStatus($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereUpdatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereUserId($value)
 * @property int|null $company_id
 * @property-read \App\Models\Company|null $company
 * @method static \Illuminate\Database\Eloquent\Builder|UserInvitation whereCompanyId($value)
 * @mixin \Eloquent
 */
class UserInvitation extends BaseModel
{

    use Notifiable, HasCompany;

    /** Invitations stop working this many days after they are created. */
    public const EXPIRY_DAYS = 7;

    protected $guarded = ['id'];

    protected $casts = [
        'expires_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $invite) {
            $invite->expires_at ??= now()->addDays(self::EXPIRY_DAYS);
        });
    }

    public static function generateCode(): string
    {
        return \Illuminate\Support\Str::random(40);
    }

    /**
     * Invitations that can still be opened or accepted: active and unexpired.
     */
    public function scopeUsable(\Illuminate\Database\Eloquent\Builder $query): \Illuminate\Database\Eloquent\Builder
    {
        return $query->where('status', 'active')->where('expires_at', '>', now());
    }

    /**
     * Link invites may be limited to one email domain (email_restriction).
     */
    public function allowsEmail(string $email): bool
    {
        if (empty($this->email_restriction)) {
            return true;
        }

        return str_ends_with(strtolower($email), '@' . strtolower(ltrim($this->email_restriction, '@')));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

}
