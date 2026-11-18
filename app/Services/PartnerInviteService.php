<?php

namespace App\Services;

use App\Contracts\KeycloakIdentityClient;
use App\Exceptions\OlKeycloakException;
use App\Models\LeadAgent;
use App\Models\Role;
use App\Models\Social;
use App\Models\User;
use App\Notifications\PartnerInvited;
use App\Support\FeatureFlags;
use App\Support\PartnerRole;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PartnerInviteService
{
    public const FLAG = 'crm.partner-keycloak-provision';

    public const STATUS_INVITED = 'invited';

    public const STATUS_ACCEPTED = 'accepted';

    /** The user columns a roster row needs; company_id keeps the company relation (invite email link and sender). */
    public const AGENT_RELATIONS = [
        'user:id,company_id,name,email,image,status,partner_invite_status,partner_invited_at,partner_invite_version',
        'user.roles',
    ];

    public const STATUS_FAILED = 'failed';

    private const PROVISIONED = 'provisioned';

    private const PROVISION_FAILED = 'failed';

    /** The partner was removed before (or while) the identity was created. */
    private const REMOVED = 'removed';

    /** Another request holds this partner's lock; nothing was changed. */
    private const BUSY = 'busy';

    /**
     * The Keycloak client is resolved only when a call to Keycloak is made, so
     * code that just reads local invite state (SSO marking acceptance, the
     * roster) never depends on the provisioning configuration.
     */
    private function keycloak(): KeycloakIdentityClient
    {
        return app(KeycloakIdentityClient::class);
    }

    public static function enabled(): bool
    {
        return FeatureFlags::enabled(self::FLAG);
    }

    /**
     * @return array{0: string, 1: string}
     */
    public static function splitName(string $name): array
    {
        $trimmed = trim($name);
        $parts = preg_split('/\s+/', $trimmed, 2) ?: [];
        $first = $parts[0] !== '' ? $parts[0] : $trimmed;
        $last = $parts[1] ?? $first;

        return [$first, $last];
    }

    /**
     * @param  array{name: string, email: string, mobile?: string|null}  $data
     * @return array{agent: LeadAgent, invite_sent: bool, message: string}
     */
    public function invite(array $data, int $companyId, User $invitedBy): array
    {
        $partnerRole = PartnerRole::ensureFor($companyId);

        $employeeRole = Role::where('name', 'employee')
            ->where('company_id', $companyId)
            ->first();

        $agent = DB::transaction(function () use ($data, $companyId, $partnerRole, $employeeRole, $invitedBy) {
            $user = new User;
            $user->company_id = $companyId;
            $user->name = $data['name'];
            $user->email = $data['email'];
            $user->mobile = $data['mobile'] ?? null;
            $user->password = bcrypt(str()->random(32));
            $user->save();

            if ($employeeRole) {
                $user->attachRole($employeeRole->id);
            }

            $user->attachRole($partnerRole->id);
            $user->assignUserRolePermission($partnerRole->id);

            return LeadAgent::create([
                'company_id' => $companyId,
                'user_id' => $user->id,
                'lead_category_id' => null,
                'added_by' => $invitedBy->id,
                'status' => 'enabled',
                'is_partner' => true,
            ]);
        });

        $outcome = self::PROVISIONED;
        if (self::enabled()) {
            $outcome = $this->provisionFor($agent->user);
        }

        $this->present($agent);

        $provisioned = $outcome === self::PROVISIONED;
        $sent = false;
        if ($provisioned) {
            $sent = $this->sendCrmInvite($agent, $invitedBy);
        }

        if ($outcome === self::REMOVED) {
            $message = __('pages.partners.msg_removed_while_inviting');
        } elseif ($outcome === self::BUSY) {
            $message = __('pages.partners.msg_busy_created');
        } elseif (! $provisioned) {
            $message = __('pages.partners.msg_enrolment_failed_created');
        } elseif (! $sent) {
            $message = __('pages.partners.msg_email_failed_created');
        } else {
            $message = __('messages.recordSaved');
        }

        return [
            'agent' => $agent,
            'invite_sent' => $sent && $provisioned,
            'message' => $message,
        ];
    }

    /**
     * @return array{ok: bool, message: string}
     */
    public function resend(LeadAgent $agent, User $invitedBy): array
    {
        if (! PartnerRole::isPartnerOnly($agent->user)) {
            return [
                'ok' => false,
                'message' => __('pages.partners.msg_resend_partner_only'),
            ];
        }

        // The roster can be stale: re-read the invite state so an invitation
        // accepted since the page loaded is not sent again or reset.
        $agent->user->refresh();
        if (! $this->canResend($agent)) {
            return [
                'ok' => false,
                'message' => $agent->user->partner_invite_status === self::STATUS_ACCEPTED
                    ? __('pages.partners.msg_resend_accepted')
                    : __('pages.partners.msg_resend_unavailable'),
            ];
        }

        if (self::enabled()) {
            $keycloakId = $this->keycloakId($agent->user);
            try {
                if ($keycloakId) {
                    $this->keycloak()->sendActionsEmail($keycloakId);
                    $this->setInviteStatus($agent->user, self::STATUS_INVITED);
                } else {
                    $outcome = $this->provisionFor($agent->user);
                    if ($outcome === self::REMOVED) {
                        return [
                            'ok' => false,
                            'message' => __('pages.partners.msg_removed_while_inviting'),
                        ];
                    }
                    if ($outcome === self::BUSY) {
                        return [
                            'ok' => false,
                            'message' => __('pages.partners.msg_busy'),
                        ];
                    }
                    if ($outcome !== self::PROVISIONED) {
                        return [
                            'ok' => false,
                            'message' => __('pages.partners.msg_enrolment_failed_retry'),
                        ];
                    }
                }
            } catch (OlKeycloakException $e) {
                Log::warning('Partner invite resend: Keycloak request failed', [
                    'user_id' => $agent->user->id,
                    'error' => $e->getMessage(),
                ]);

                return [
                    'ok' => false,
                    'message' => __('pages.partners.msg_enrolment_failed_retry'),
                ];
            }
        }

        $sent = $this->sendCrmInvite($agent, $invitedBy);

        return $sent
            ? ['ok' => true, 'message' => __('pages.partners.invite_sent')]
            : ['ok' => false, 'message' => __('pages.partners.msg_email_failed_retry')];
    }

    public function destroy(LeadAgent $agent): void
    {
        // Same lock as provisioning, so removal cannot slip between the
        // identity being created and it being recorded against the user.
        $this->withAccountLock($agent->user_id, function () use ($agent) {
            // Provisioning may have finished while this waited for the lock, so
            // decide from the user as it is now (invite status and roles), not
            // as it was when the roster row was loaded.
            $user = $agent->user?->fresh('roles');

            // Only invitation-owned accounts have an identity this flow may
            // disable. A staff member flagged as a partner keeps their SSO
            // login: they only lose the partner flag.
            if (self::enabled() && $this->managesIdentity($user)) {
                $this->disableIdentity($user);
            }

            $agent->update(['is_partner' => false]);
        });
    }

    /**
     * Load what the roster row needs, then present it. For a single agent
     * (store, invite, resend); the roster itself loads these in one batch
     * and calls decorate().
     */
    public function present(LeadAgent $agent): LeadAgent
    {
        $agent->loadCount('referredLeads')->load(self::AGENT_RELATIONS);

        return $this->decorate($agent);
    }

    /**
     * Add the invite status and resend flag from relations that are already
     * loaded (user + roles), without querying them again.
     */
    /**
     * @param  array<int, string>|null  $keycloakIds  user id => Keycloak id for the whole
     *                                                page (see keycloakIdsFor()), so rows
     *                                                with no invite status need no query.
     */
    public function decorate(LeadAgent $agent, ?array $keycloakIds = null): LeadAgent
    {
        $inviteStatus = PartnerRole::isPartnerOnly($agent->user)
            ? $agent->user?->partner_invite_status
            : null;

        $agent->setAttribute('partner_invite_status', $inviteStatus);
        $agent->setAttribute('can_resend', $this->canResend($agent, $keycloakIds));

        return $agent;
    }

    /**
     * @param  array<int, string>|null  $keycloakIds  See decorate().
     */
    public function canResend(LeadAgent $agent, ?array $keycloakIds = null): bool
    {
        if (! PartnerRole::isPartnerOnly($agent->user)) {
            return false;
        }

        $status = $agent->user?->partner_invite_status;

        // Accepted stays accepted, whatever the provisioning flag says now:
        // the flag may have been switched off after they signed in.
        if ($status === self::STATUS_ACCEPTED) {
            return false;
        }

        if (! self::enabled()) {
            return true;
        }

        if (in_array($status, [self::STATUS_INVITED, self::STATUS_FAILED], true)) {
            return true;
        }

        if ($keycloakIds !== null) {
            return ! isset($keycloakIds[$agent->user_id]);
        }

        return $this->keycloakId($agent->user) === null;
    }

    /**
     * One query for a page of roster rows: user id => Keycloak id. Empty when
     * provisioning is off (the ids are not consulted then).
     *
     * @param  iterable<LeadAgent>  $agents
     * @return array<int, string>
     */
    public function keycloakIdsFor(iterable $agents): array
    {
        if (! self::enabled()) {
            return [];
        }

        $userIds = collect($agents)->pluck('user_id')->filter()->unique()->values();
        if ($userIds->isEmpty()) {
            return [];
        }

        return Social::query()
            ->whereIn('user_id', $userIds)
            ->where('social_service', 'keycloak')
            ->pluck('social_id', 'user_id')
            ->filter(fn ($id) => is_string($id) && $id !== '')
            ->all();
    }

    public function markAccepted(User $user): void
    {
        // A partner who signs in has accepted, even if the last enrolment
        // attempt failed (they already had a verified Keycloak account).
        // Accounts with no invite status (legacy) are left as they are.
        if (! in_array($user->partner_invite_status, [self::STATUS_INVITED, self::STATUS_FAILED], true)) {
            return;
        }

        $this->setInviteStatus($user, self::STATUS_ACCEPTED);
    }

    /**
     * Mirror a saved status/email change to the partner's Keycloak identity.
     *
     * Call from the model's `updated` event. Only invitation-owned (partner-only)
     * accounts are touched: staff share their Keycloak realm with other apps,
     * so a staff status or email change must never be pushed from here. The
     * change is read now (wasChanged) and sent once the surrounding transaction
     * has committed, so a rolled-back save never leaves Keycloak ahead of the CRM.
     */
    public function syncLifecycle(User $user): void
    {
        if (! self::enabled()) {
            return;
        }

        if (! $this->managesIdentity($user)) {
            return;
        }

        $id = $this->keycloakId($user);
        if (! $id) {
            return;
        }

        $patch = [];
        if ($user->wasChanged('status')) {
            if ($user->status === 'deactive') {
                $patch['enabled'] = false;
            } elseif ($this->isActivePartner($user)) {
                // Reactivated: let a partner who is still a partner sign in again.
                $patch['enabled'] = true;
            }
        }
        if ($user->wasChanged('email') && filled($user->email)) {
            $patch['email'] = strtolower(trim((string) $user->email));
        }

        if ($patch === []) {
            return;
        }

        $userId = $user->id;
        DB::afterCommit(function () use ($id, $patch, $userId) {
            try {
                // Removal may have disabled the identity since this was decided:
                // an enable is sent only if the user is still a partner, checked
                // under the same lock removal takes.
                if (($patch['enabled'] ?? false) === true) {
                    $this->withAccountLock($userId, function () use ($id, $patch, $userId) {
                        if (! LeadAgent::withoutGlobalScopes()->where('user_id', $userId)->where('is_partner', true)->exists()) {
                            unset($patch['enabled']);
                        }
                        if ($patch !== []) {
                            $this->keycloak()->update($id, $patch);
                        }
                    });

                    return;
                }

                $this->keycloak()->update($id, $patch);
            } catch (\Throwable $e) {
                report($e);
                Log::warning('Partner Keycloak lifecycle sync failed', [
                    'user_id' => $userId,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }

    /**
     * Flag an existing agent as a partner again (the Add Partner picker).
     *
     * Removing a partner disabled their Keycloak identity, so adding the same
     * person back must switch it on again, or the roster would show them as
     * invited while they still cannot sign in.
     */
    public function add(LeadAgent $agent): void
    {
        $this->withAccountLock($agent->user_id, function () use ($agent) {
            $agent->update(['is_partner' => true]);

            if (self::enabled() && $this->managesIdentity($agent->user) && $agent->user->status !== 'deactive') {
                $this->setIdentityEnabled($agent->user, true);
            }
        });
    }

    public function disableIdentity(?User $user): void
    {
        $this->setIdentityEnabled($user, false);
    }

    private function setIdentityEnabled(?User $user, bool $enabled): void
    {
        if (! $user) {
            return;
        }

        $id = $this->keycloakId($user);
        if (! $id) {
            return;
        }

        try {
            $this->keycloak()->update($id, ['enabled' => $enabled]);
        } catch (\Throwable $e) {
            report($e);
            Log::warning($enabled ? 'Partner Keycloak enable failed' : 'Partner Keycloak disable failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Create (or find) the Keycloak identity and record it on the user.
     *
     * Runs under the per-account lock that destroy() also takes: either the
     * partner is removed first (nothing is sent to Keycloak), or provisioning
     * finishes and is recorded first (removal then disables the new identity).
     *
     * @return self::PROVISIONED|self::PROVISION_FAILED|self::REMOVED|self::BUSY
     */
    private function provisionFor(User $user): string
    {
        try {
            return $this->provisionLocked($user);
        } catch (LockTimeoutException) {
            return self::BUSY;
        }
    }

    private function provisionLocked(User $user): string
    {
        return $this->withAccountLock($user->id, function () use ($user) {
            if (! $this->isActivePartner($user)) {
                return self::REMOVED;
            }

            [$first, $last] = self::splitName((string) $user->name);

            try {
                $result = $this->keycloak()->provision((string) $user->email, $first, $last, true);
            } catch (OlKeycloakException $e) {
                Log::warning('Partner invite: Keycloak provision failed', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
                $this->setInviteStatus($user, self::STATUS_FAILED);

                return self::PROVISION_FAILED;
            }

            // The link and the status are saved together: a link without a
            // status would hide Resend and block a new invite for good.
            try {
                DB::transaction(function () use ($user, $result) {
                    Social::updateOrCreate(['user_id' => $user->id], [
                        'social_id' => $result->keycloakUserId,
                        'social_service' => 'keycloak',
                    ]);

                    $this->setInviteStatus($user, self::STATUS_INVITED);
                });
            } catch (\Throwable $e) {
                report($e);
                Log::warning('Partner invite: could not record the Keycloak identity', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);

                // Nothing was saved; mark the attempt failed (best effort) so
                // Resend is offered and the retry reuses the remote identity.
                try {
                    $this->setInviteStatus($user, self::STATUS_FAILED);
                } catch (\Throwable) {
                }

                return self::PROVISION_FAILED;
            }

            return self::PROVISIONED;
        });
    }

    /**
     * Whether this flow owns the user's Keycloak identity: a partner-only
     * account that went through an invitation (the persisted status is the
     * marker). A Keycloak sign-in link alone proves nothing: every SSO user,
     * staff included, has one.
     */
    private function managesIdentity(?User $user): bool
    {
        return $user !== null
            && $user->partner_invite_status !== null
            && PartnerRole::isPartnerOnly($user);
    }

    private function isActivePartner(User $user): bool
    {
        return LeadAgent::withoutGlobalScopes()
            ->where('user_id', $user->id)
            ->where('is_partner', true)
            ->exists();
    }

    /**
     * Serialize provisioning and removal for one account. The lock outlives the
     * OL timeout; if it cannot be had in time the caller gets the exception
     * rather than racing.
     *
     * @template T
     *
     * @param  callable(): T  $callback
     * @return T
     *
     * @throws LockTimeoutException
     */
    private function withAccountLock(int $userId, callable $callback): mixed
    {
        // Waits for the lock a little longer than one OL call can take.
        $wait = (int) config('services.ol.keycloak.lock_wait_seconds', 20);

        return Cache::lock('partner-invite:'.$userId, 30)->block($wait, $callback);
    }

    /**
     * Set the invite status without ever moving an accepted invitation back:
     * the partner may accept while an admin's request is still in flight.
     */
    private function setInviteStatus(User $user, string $status): void
    {
        // partner_invite_version counts status changes (incremented in SQL, so
        // concurrent changes each add one): the roster compares it so an older
        // response never replaces newer state on screen.
        $values = [
            'partner_invite_status' => $status,
            'partner_invite_version' => DB::raw('partner_invite_version + 1'),
        ];
        if ($status === self::STATUS_INVITED) {
            $values['partner_invited_at'] = now();
        }

        User::withoutGlobalScopes()
            ->whereKey($user->id)
            ->where(fn ($query) => $query
                ->whereNull('partner_invite_status')
                ->orWhere('partner_invite_status', '!=', self::STATUS_ACCEPTED))
            ->update($values);

        $user->refresh();
    }

    private function keycloakId(?User $user): ?string
    {
        if (! $user) {
            return null;
        }

        $id = Social::where('user_id', $user->id)
            ->where('social_service', 'keycloak')
            ->value('social_id');

        return is_string($id) && $id !== '' ? $id : null;
    }

    private function sendCrmInvite(LeadAgent $agent, User $invitedBy): bool
    {
        try {
            $agent->user->notify(new PartnerInvited($agent->user, $invitedBy->name));

            return true;
        } catch (\Throwable $e) {
            report($e);

            return false;
        }
    }
}
