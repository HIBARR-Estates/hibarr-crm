<?php

namespace App\Services;

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

        abort_unless(
            $admin && $current && (int) $admin->company_id === (int) $current->company_id,
            403
        );

        $employeeId = $current->id;

        $this->assume($request, $admin);
        $request->session()->forget([self::SESSION_ID, self::SESSION_NAME]);

        Log::info('Employee impersonation ended', [
            'impersonator_id' => $admin->id,
            'employee_id' => $employeeId,
            'company_id' => $admin->company_id,
        ]);
    }

    /**
     * Note the admin on an activity recorded while they are signed in as
     * someone else. The activity itself stays attributed to that person.
     *
     * @param  array<string, mixed>|null  $metadata
     * @return array<string, mixed>|null
     */
    public function attribute(?array $metadata): ?array
    {
        if (! $this->isActive()) {
            return $metadata;
        }

        $metadata ??= [];
        $metadata['impersonator_id'] ??= (int) session(self::SESSION_ID);

        $name = session(self::SESSION_NAME);

        if (! is_string($name) || $name === '') {
            $name = User::query()
                ->withoutGlobalScope(ActiveScope::class)
                ->whereKey(session(self::SESSION_ID))
                ->value('name');
        }

        if (is_string($name) && $name !== '') {
            $metadata['impersonator_name'] ??= $name;
        }

        return $metadata;
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
