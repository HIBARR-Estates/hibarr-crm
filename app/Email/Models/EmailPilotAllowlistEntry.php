<?php

namespace App\Email\Models;

use App\Models\BaseModel;
use App\Models\User;
use App\Traits\HasCompany;
use Database\Factories\Email\EmailPilotAllowlistEntryFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Who may use CRM Email during the pilot, on top of the crm.email flag.
 * A row with a user is that user; a row without one is the whole company.
 *
 * @property int $id
 * @property int $company_id
 * @property int|null $user_id
 * @property int|null $added_by
 */
class EmailPilotAllowlistEntry extends BaseModel
{
    use HasCompany;
    use HasFactory;

    protected $table = 'email_pilot_allowlist';

    protected $fillable = [
        'company_id',
        'user_id',
        'added_by',
    ];

    protected static function newFactory(): EmailPilotAllowlistEntryFactory
    {
        return EmailPilotAllowlistEntryFactory::new();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withoutGlobalScopes();
    }

    /**
     * True only for a user listed by name or whose company is listed as a
     * whole. Always checked against the user's own company, whoever is
     * logged in.
     */
    public static function allows(?User $user): bool
    {
        if ($user === null || ! $user->exists || $user->company_id === null) {
            return false;
        }

        return static::withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->where(fn ($query) => $query->where('user_id', $user->id)->orWhereNull('user_id'))
            ->exists();
    }
}
