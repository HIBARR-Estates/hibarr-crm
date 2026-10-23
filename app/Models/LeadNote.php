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
     * - `all`   → every note the private-note policy allows.
     * - `added` → only notes the user authored.
     * - `owned` → only notes the user is a member of, and only for employees.
     * - `both`  → authored OR member.
     * - `none`  → nothing.
     *
     * A private note (`type = 1`) is bound to its author and member list: a
     * non-admin sees it only when they authored it or are a member of it —
     * including under the `all` scope, which widens the *scope* and not the
     * private-note policy. Admins are unrestricted. Public notes (`type = 0`)
     * are readable by everyone the scope admits.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<LeadNote>  $query
     * @return \Illuminate\Database\Eloquent\Builder<LeadNote>
     */
    public function scopeVisibleTo($query, User $user)
    {
        $scope = $user->permission('view_lead_note');

        if ($scope === 'none') {
            return $query->whereRaw('1 = 0');
        }

        if ($scope === 'all') {
            if ($this->hasRole($user, 'admin')) {
                return $query;
            }

            // Non-admin: a private note is only visible to its author and
            // members. Public notes stay readable.
            return $query->where(function ($query) use ($user): void {
                $query->where('type', 0)
                    ->orWhere(function ($query) use ($user): void {
                        $query->where('type', 1)
                            ->where(function ($query) use ($user): void {
                                $query->where('lead_notes.added_by', $user->id)
                                    ->orWhereHas('members', function ($query) use ($user): void {
                                        $query->where('user_id', $user->id);
                                    });
                            });
                    });
            });
        }

        return $query->where(function ($query) use ($user, $scope): void {
            if ($scope === 'added' || $scope === 'both') {
                $query->orWhere('lead_notes.added_by', $user->id);
            }

            if ($scope === 'owned' || $scope === 'both') {
                $query->orWhere(function ($query) use ($user, $scope): void {
                    // `owned` additionally requires the employee role, matching
                    // the direct note page's rule. `both` does not.
                    if ($scope === 'owned' && ! $this->hasRole($user, 'employee')) {
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

        if ($scope === 'none') {
            return false;
        }

        if ($scope === 'all') {
            return $this->passesPrivateNotePolicy($user);
        }

        $isAuthor = (int) $this->added_by === (int) $user->id;
        $isMember = $this->members()->where('user_id', $user->id)->exists();

        return match ($scope) {
            'added' => $isAuthor,
            'owned' => $isMember && $this->hasRole($user, 'employee'),
            'both' => $isAuthor || $isMember,
            default => false,
        };
    }

    /**
     * Whether the given user may edit this note.
     *
     * Writing is governed by `edit_lead_note`, not by the read scope: the read
     * scope only decides whether the note is visible at all. The author/member
     * shape mirrors the delete scope the controller already applies
     * (LeadNoteController::destroy()) and the notes list's edit affordance
     * (LeadNotesDataTable).
     */
    public function isEditableBy(User $user): bool
    {
        $scope = $user->permission('edit_lead_note');

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
            'owned' => $isMember && $this->hasRole($user, 'employee'),
            'both' => $isAuthor || $isMember,
            default => false,
        };
    }

    /**
     * The private-note policy, applied on top of any read scope.
     *
     * A public note (`type = 0`) is readable by everyone the scope admits. A
     * private note (`type = 1`) is bound to its author and member list —
     * except for admins, who are unrestricted.
     */
    private function passesPrivateNotePolicy(User $user): bool
    {
        if ($this->hasRole($user, 'admin')) {
            return true;
        }

        if ((int) $this->type !== 1) {
            return true;
        }

        return (int) $this->added_by === (int) $user->id
            || $this->members()->where('user_id', $user->id)->exists();
    }

    /**
     * Whether the user holds the given role.
     *
     * Prefers the relation on the user being checked, and falls back to the
     * session helper the rest of the codebase uses.
     */
    private function hasRole(User $user, string $role): bool
    {
        if ($user->relationLoaded('roles')) {
            $roles = $user->getRelation('roles');

            if ($roles instanceof \Illuminate\Support\Collection) {
                return $roles->contains('name', $role);
            }

            if (is_array($roles)) {
                foreach ($roles as $candidate) {
                    if (is_object($candidate) && ($candidate->name ?? null) === $role) {
                        return true;
                    }
                }
            }
        }

        return in_array($role, (array) user_roles(), true);
    }
}
