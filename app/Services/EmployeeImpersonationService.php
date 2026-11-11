<?php

namespace App\Services;

use App\Support\AuditLog\AuditRecorder;
use App\Enums\CrmEventGenerationType;
use App\Enums\CrmEventSource;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

/**
 * Switches the current session to an employee and back, without recording a
 * real sign-in. Auth::login() would update last_login and rotate the Keycloak
 * tokens that logout uses to end the admin's SSO session.
 */
class EmployeeImpersonationService
{
    public const SESSION_ID = 'impersonator_id';

    public const SESSION_NAME = 'impersonator_name';

    public function isActive(): bool
    {
        return session()->has(self::SESSION_ID);
    }

    /**
     * Why this admin may not sign in as this user, or null when they may.
     */
    public function blockReason(?User $actor, User $target): ?string
    {
        if ($this->isActive()) {
            return 'already_impersonating';
        }

        if (! $actor || ! $this->hasRoleName($actor, 'admin')) {
            return 'not_admin';
        }

        if ((int) $actor->id === (int) $target->id) {
            return 'self';
        }

        if ((int) $actor->company_id !== (int) $target->company_id) {
            return 'other_company';
        }

        if ($this->hasRoleName($target, 'admin')) {
            return 'admin';
        }

        if (! $this->hasRoleName($target, 'employee')) {
            return 'not_employee';
        }

        // Authenticate logs the session out (and flushes it) unless the user
        // is active and allowed to sign in. An inactive target would drop the
        // admin out of the app on the next request.
        if ($target->status !== 'active') {
            return 'inactive';
        }

        if ($target->login !== 'enable') {
            return 'login_disabled';
        }

        if (! $target->admin_approval) {
            return 'unapproved';
        }

        return null;
    }

    public function start(Request $request, User $target): void
    {
        $actor = $request->user();
        $reason = $this->blockReason($actor, $target);

        abort_if($reason !== null, 403, __('app.impersonation.block.'.$reason));
        abort_unless($actor instanceof User, 403);

        $this->assume($request, $target);

        $request->session()->put(self::SESSION_ID, $actor->id);
        $request->session()->put(self::SESSION_NAME, $actor->name);

        $this->recordImpersonationEvent(
            'impersonation_started',
            $actor,
            $target,
            $actor->name.' started acting on behalf of '.$target->name.'.',
        );

        Log::info('Employee impersonation started', [
            'impersonator_id' => $actor->id,
            'employee_id' => $target->id,
            'company_id' => $target->company_id,
        ]);
    }

    public function leave(Request $request): void
    {
        $impersonatorId = session(self::SESSION_ID);
        abort_unless($impersonatorId, 403);

        $current = $request->user();

        $admin = User::query()
            ->withoutGlobalScope(ActiveScope::class)
            ->find($impersonatorId);

        if (
            ! $admin instanceof User
            || ! $current instanceof User
            || (int) $admin->company_id !== (int) $current->company_id
        ) {
            abort(403);
        }

        $employeeId = $current->id;

        $this->assume($request, $admin);
        $request->session()->forget([self::SESSION_ID, self::SESSION_NAME]);

        $this->recordImpersonationEvent(
            'impersonation_ended',
            $admin,
            $current,
            $admin->name.' stopped acting on behalf of '.$current->name.'.',
        );

        Log::info('Employee impersonation ended', [
            'impersonator_id' => $admin->id,
            'employee_id' => $employeeId,
            'company_id' => $admin->company_id,
        ]);
    }

    /**
     * An action recorded while impersonating was taken by the admin, on behalf
     * of the employee the session is signed in as.
     *
     * Events with no user, or a user other than that employee, are left alone.
     *
     * @param  array<string, mixed>  $event
     * @return array<string, mixed>
     */
    public function attributeEvent(array $event): array
    {
        if (! $this->isActive()) {
            return $event;
        }

        $adminId = (int) session(self::SESSION_ID);
        $sessionUser = Auth::user();
        $behalfId = (int) ($sessionUser?->getAuthIdentifier() ?? 0);

        if ($adminId === 0 || $behalfId === 0 || $behalfId === $adminId) {
            return $event;
        }

        $recordedUser = isset($event['user_id']) ? (int) $event['user_id'] : 0;

        if ($recordedUser !== $behalfId && $recordedUser !== $adminId) {
            return $event;
        }

        if ($recordedUser === $behalfId) {
            $event['user_id'] = $adminId;
        }

        $metadata = is_array($event['metadata'] ?? null) ? $event['metadata'] : [];
        $metadata['on_behalf_of_id'] ??= $behalfId;
        $metadata['impersonator_id'] ??= $adminId;

        $behalfName = $sessionUser?->name;
        $adminName = $this->impersonatorName($adminId);

        if (is_string($behalfName) && $behalfName !== '') {
            $metadata['on_behalf_of_name'] ??= $behalfName;
        }

        if ($adminName !== '') {
            $metadata['impersonator_name'] ??= $adminName;
        }

        $event['metadata'] = $metadata;

        return $event;
    }

    /**
     * Write the start or end of an impersonation as its own CRM event.
     * The actor is the admin. The subject is the employee.
     */
    private function recordImpersonationEvent(string $slug, User $admin, User $employee, string $comment): void
    {
        app(AuditRecorder::class)->recordImpersonation($slug, $admin, $employee);

        try {
            $event = app(CrmEventService::class)->record([
                'event_type_slug' => $slug,
                'company_id' => (int) $employee->company_id,
                'user_id' => (int) $admin->id,
                'model_type' => User::class,
                'model_id' => (int) $employee->id,
                'generation_type' => CrmEventGenerationType::USER_GENERATED->value,
                'source' => CrmEventSource::CONTROLLER->value,
                'metadata' => [
                    'comment' => $comment,
                    'on_behalf_of_id' => (int) $employee->id,
                    'on_behalf_of_name' => $employee->name,
                    'impersonator_id' => (int) $admin->id,
                    'impersonator_name' => $admin->name,
                ],
            ]);

            if ($event === null) {
                Log::warning('Impersonation event was not recorded', [
                    'slug' => $slug,
                    'impersonator_id' => $admin->id,
                    'employee_id' => $employee->id,
                ]);
            }
        } catch (\Throwable $exception) {
            Log::warning('Impersonation event was not recorded', [
                'slug' => $slug,
                'impersonator_id' => $admin->id,
                'employee_id' => $employee->id,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function impersonatorName(int $adminId): string
    {
        $name = session(self::SESSION_NAME);

        if (is_string($name) && $name !== '') {
            return $name;
        }

        $stored = User::query()
            ->withoutGlobalScope(ActiveScope::class)
            ->whereKey($adminId)
            ->value('name');

        return is_string($stored) ? $stored : '';
    }

    /**
     * Point the session guard at $user and drop the cached identity so the
     * next user() / user_roles() call rebuilds it for that account.
     */
    private function assume(Request $request, User $user): void
    {
        /** @var \Illuminate\Auth\SessionGuard $guard */
        $guard = Auth::guard();

        $request->session()->put($guard->getName(), $user->getAuthIdentifier());
        $guard->setUser($user);
        $request->session()->migrate(true);

        $request->session()->forget([
            'user',
            'user_roles',
            'user_role_ids',
        ]);

        // AuthenticateSession compares this to the signed-in user and logs
        // the session out when it differs. It must follow the account switch.
        $request->session()->put(
            'password_hash_'.Auth::getDefaultDriver(),
            $user->getAuthPassword(),
        );
    }

    private function hasRoleName(User $user, string $role): bool
    {
        $roles = $user->relationLoaded('roles')
            ? $user->roles
            : $user->roles()->get(['roles.id', 'roles.name']);

        return $roles->contains(fn ($item) => $item->name === $role);
    }
}
