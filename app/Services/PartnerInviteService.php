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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class PartnerInviteService
{
    public const FLAG = 'crm.partner-keycloak-provision';

    public const STATUS_INVITED = 'invited';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_FAILED = 'failed';

    public function __construct(
        private readonly KeycloakIdentityClient $keycloak,
    ) {
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

        $provisioned = true;
        if (self::enabled()) {
            $provisioned = $this->provisionFor($agent->user);
        }

        $this->present($agent);

        $sent = false;
        if ($provisioned) {
            $sent = $this->sendCrmInvite($agent, $invitedBy);
        }

        if (! $provisioned) {
            $message = 'The partner was created, but Keycloak enrolment could not be completed. Use Resend invite.';
        } elseif (! $sent) {
            $message = 'The partner was created, but the invitation email could not be sent. Use Resend invite.';
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
                'message' => 'Only partner accounts created through Invite Partner can be re-invited.',
            ];
        }

        if (self::enabled()) {
            $keycloakId = $this->keycloakId($agent->user);
            try {
                if ($keycloakId) {
                    $this->keycloak->sendActionsEmail($keycloakId);
                    $this->markInvited($agent->user);
                } elseif (! $this->provisionFor($agent->user)) {
                    return [
                        'ok' => false,
                        'message' => 'Keycloak enrolment could not be completed. Please try again.',
                    ];
                }
            } catch (OlKeycloakException $e) {
                Log::warning('Partner invite resend: Keycloak request failed', [
                    'user_id' => $agent->user->id,
                    'error' => $e->getMessage(),
                ]);

                return [
                    'ok' => false,
                    'message' => 'Keycloak enrolment could not be completed. Please try again.',
                ];
            }
        }

        $sent = $this->sendCrmInvite($agent, $invitedBy);
        $this->present($agent);

        return $sent
            ? ['ok' => true, 'message' => 'Invitation sent.']
            : ['ok' => false, 'message' => 'The invitation email could not be sent. Please try again.'];
    }

    public function destroy(LeadAgent $agent): void
    {
        if (self::enabled()) {
            $this->disableIdentity($agent->user);
        }

        $agent->update(['is_partner' => false]);
    }

    public function present(LeadAgent $agent): LeadAgent
    {
        $agent->loadCount('referredLeads')->load([
            'user:id,name,email,image,status,partner_invite_status,partner_invited_at',
            'user.roles',
        ]);

        $inviteStatus = PartnerRole::isPartnerOnly($agent->user)
            ? $agent->user?->partner_invite_status
            : null;

        $agent->setAttribute('partner_invite_status', $inviteStatus);
        $agent->setAttribute('can_resend', $this->canResend($agent));

        return $agent;
    }

    public function canResend(LeadAgent $agent): bool
    {
        if (! PartnerRole::isPartnerOnly($agent->user)) {
            return false;
        }

        if (! self::enabled()) {
            return true;
        }

        $status = $agent->user?->partner_invite_status;

        if ($status === self::STATUS_ACCEPTED) {
            return false;
        }

        if (in_array($status, [self::STATUS_INVITED, self::STATUS_FAILED], true)) {
            return true;
        }

        return $this->keycloakId($agent->user) === null;
    }

    public function markAccepted(User $user): void
    {
        if ($user->partner_invite_status !== self::STATUS_INVITED) {
            return;
        }

        $user->partner_invite_status = self::STATUS_ACCEPTED;
        $user->save();
    }

    public function syncLifecycle(User $user): void
    {
        if (! self::enabled()) {
            return;
        }

        $id = $this->keycloakId($user);
        if (! $id) {
            return;
        }

        $patch = [];
        if ($user->isDirty('status') && $user->status === 'deactive') {
            $patch['enabled'] = false;
        }
        if ($user->isDirty('email') && filled($user->email)) {
            $patch['email'] = strtolower(trim((string) $user->email));
        }

        if ($patch === []) {
            return;
        }

        try {
            $this->keycloak->update($id, $patch);
        } catch (\Throwable $e) {
            report($e);
            Log::warning('Partner Keycloak lifecycle sync failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public function disableIdentity(?User $user): void
    {
        if (! $user) {
            return;
        }

        $id = $this->keycloakId($user);
        if (! $id) {
            return;
        }

        try {
            $this->keycloak->update($id, ['enabled' => false]);
        } catch (\Throwable $e) {
            report($e);
            Log::warning('Partner Keycloak disable failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function provisionFor(User $user): bool
    {
        [$first, $last] = self::splitName((string) $user->name);

        try {
            $result = $this->keycloak->provision((string) $user->email, $first, $last, true);
        } catch (OlKeycloakException $e) {
            Log::warning('Partner invite: Keycloak provision failed', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            $user->partner_invite_status = self::STATUS_FAILED;
            $user->save();

            return false;
        }

        Social::updateOrCreate(['user_id' => $user->id], [
            'social_id' => $result->keycloakUserId,
            'social_service' => 'keycloak',
        ]);

        $this->markInvited($user);

        return true;
    }

    private function markInvited(User $user): void
    {
        $user->partner_invite_status = self::STATUS_INVITED;
        $user->partner_invited_at = now();
        $user->save();
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
