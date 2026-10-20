<?php

namespace App\Models;

use App\Enums\IntegrationOrigin;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * App\Models\ClientNote
 *
 * @property int $id
 * @property int|null $client_id
 * @property string $title
 * @property int $type
 * @property int|null $member_id
 * @property int $is_client_show
 * @property int $ask_password
 * @property string $details
 * @property int|null $added_by
 * @property int|null $last_updated_by
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 *
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote query()
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereAddedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereAskPassword($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereClientId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereCreatedAt($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereDetails($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereIsClientShow($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereLastUpdatedBy($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereMemberId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereTitle($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereType($value)
 * @method static \Illuminate\Database\Eloquent\Builder|ClientNote whereUpdatedAt($value)
 *
 * @property-read \App\Models\User|null $client
 * @property-read \Illuminate\Database\Eloquent\Collection|\App\Models\ClientUserNote[] $members
 * @property-read int|null $members_count
 * @property int|null $lead_id
 * @property int $is_lead_show
 *
 * @method static \Illuminate\Database\Eloquent\Builder|LeadNote whereIsLeadShow($value)
 * @method static \Illuminate\Database\Eloquent\Builder|LeadNote whereLeadId($value)
 *
 * @mixin \Eloquent
 */
class LeadNote extends BaseModel
{
    // ApiModel hides created_at/updated_at by default; the notes UI needs both
    // to show when a note was written and whether it was edited.
    protected $hidden = ['pivot'];

    protected $casts = [
        'remind_at' => 'datetime',
        'reminders' => 'array',
        'integration_origin' => IntegrationOrigin::class,
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(LeadUserNote::class, 'lead_note_id');
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    /**
     * Restrict the query to the notes the given user may read.
     *
     * The rule mirrors the per-instance check the direct note page runs
     * (LeadNoteController::show()/edit()), so a note reachable from a parent
     * record — e.g. the Lead page's notes tab — is never readable through a
     * weaker scope than through the note's own URL:
     *
     * - `all`   → every note.
     * - `added` → only notes the user authored.
     * - `owned` → only notes the user is a member of, and only for employees.
     * - `both`  → authored OR member.
     * - `none`  → nothing.
     *
     * A private note (`type = 1`) is additionally bound to its member list;
     * the `owned`/`both` scopes grant access through that membership.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<LeadNote>  $query
     * @return \Illuminate\Database\Eloquent\Builder<LeadNote>
     */
    public function scopeVisibleTo($query, User $user)
    {
        $scope = $user->permission('view_lead_note');

        if ($scope === 'all') {
            return $query;
        }

        if ($scope === 'none') {
            return $query->whereRaw('1 = 0');
        }

        return $query->where(function ($query) use ($user, $scope): void {
            if ($scope === 'added' || $scope === 'both') {
                $query->orWhere('lead_notes.added_by', $user->id);
            }

            if ($scope === 'owned' || $scope === 'both') {
                $query->orWhere(function ($query) use ($user, $scope): void {
                    // `owned` additionally requires the employee role, matching
                    // the direct note page's rule. `both` does not.
                    if ($scope === 'owned' && ! $this->isEmployee($user)) {
                        $query->whereRaw('1 = 0');

                        return;
                    }

                    $query->whereHas('members', function ($query) use ($user): void {
                        $query->where('user_id', $user->id);
                    });
                });
            }
        });
    }

    /**
     * Whether the given user may read this note.
     *
     * The instance-level twin of scopeVisibleTo() — the direct note page uses
     * this, the Lead page's list uses the scope, and both must agree.
     */
    public function isVisibleTo(User $user): bool
    {
        $scope = $user->permission('view_lead_note');

        if ($scope === 'all') {
            return true;
        }

        if ($scope === 'none') {
            return false;
        }

        $isAuthor = (int) $this->added_by === (int) $user->id;
        $isMember = $this->members()->where('user_id', $user->id)->exists();

        return match ($scope) {
            'added' => $isAuthor,
            'owned' => $isMember && $this->isEmployee($user),
            'both' => $isAuthor || $isMember,
            default => false,
        };
    }

    /**
     * Whether the user holds the `employee` role.
     *
     * Prefers the relation on the user being checked, and falls back to the
     * session helper the rest of the codebase uses.
     */
    private function isEmployee(User $user): bool
    {
        if ($user->relationLoaded('roles')) {
            $roles = $user->getRelation('roles');

            if ($roles instanceof \Illuminate\Support\Collection) {
                return $roles->contains('name', 'employee');
            }

            if (is_array($roles)) {
                foreach ($roles as $role) {
                    if (is_object($role) && ($role->name ?? null) === 'employee') {
                        return true;
                    }
                }
            }
        }

        return in_array('employee', (array) user_roles(), true);
    }
}
