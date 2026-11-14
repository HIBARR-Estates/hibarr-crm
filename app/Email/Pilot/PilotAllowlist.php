<?php

namespace App\Email\Pilot;

use App\Email\Models\EmailPilotAllowlistEntry;
use App\Models\User;
use DomainException;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Company-scoped pilot membership on top of crm.email.
 * Admins manage who may connect and sync; the flag alone never opens Email.
 */
class PilotAllowlist
{
    /**
     * @return list<array{id: int, scope: string, user_id: int|null, user_name: string|null, user_email: string|null, added_by_id: int|null, added_by_name: string|null, created_at: string|null}>
     */
    public function presentFor(User $actor): array
    {
        return $this->entries($actor)
            ->map(fn (EmailPilotAllowlistEntry $entry) => $this->present($entry))
            ->values()
            ->all();
    }

    public function addUser(User $actor, int $userId): EmailPilotAllowlistEntry
    {
        $this->assertCompany($actor);

        $user = User::withoutGlobalScopes()
            ->where('company_id', $actor->company_id)
            ->whereKey($userId)
            ->first();

        if ($user === null) {
            throw ValidationException::withMessages(['user_id' => 'user_not_found']);
        }

        $existing = EmailPilotAllowlistEntry::withoutGlobalScopes()
            ->where('company_id', $actor->company_id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        return EmailPilotAllowlistEntry::withoutGlobalScopes()->create([
            'company_id' => $actor->company_id,
            'user_id' => $user->id,
            'added_by' => $actor->id,
        ]);
    }

    public function addCompany(User $actor): EmailPilotAllowlistEntry
    {
        $this->assertCompany($actor);

        $existing = EmailPilotAllowlistEntry::withoutGlobalScopes()
            ->where('company_id', $actor->company_id)
            ->whereNull('user_id')
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        return EmailPilotAllowlistEntry::withoutGlobalScopes()->create([
            'company_id' => $actor->company_id,
            'user_id' => null,
            'added_by' => $actor->id,
        ]);
    }

    public function remove(User $actor, int $entryId): void
    {
        $this->assertCompany($actor);

        $entry = EmailPilotAllowlistEntry::withoutGlobalScopes()
            ->where('company_id', $actor->company_id)
            ->whereKey($entryId)
            ->first();

        if ($entry === null) {
            throw new DomainException('not_found');
        }

        $entry->delete();
    }

    /**
     * Same-company users who are not already on a personal allowlist row.
     *
     * @return list<array{id: int, name: string, email: string|null}>
     */
    public function candidates(User $actor, string $term): array
    {
        $this->assertCompany($actor);

        $term = trim($term);

        if (mb_strlen($term) < 2) {
            return [];
        }

        $listed = EmailPilotAllowlistEntry::withoutGlobalScopes()
            ->where('company_id', $actor->company_id)
            ->whereNotNull('user_id')
            ->pluck('user_id')
            ->all();

        $like = '%'.$term.'%';

        return User::withoutGlobalScopes()
            ->where('company_id', $actor->company_id)
            ->when($listed !== [], fn ($query) => $query->whereNotIn('id', $listed))
            ->where(function ($query) use ($like) {
                $query->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like);
            })
            ->orderBy('name')
            ->limit(10)
            ->get(['id', 'name', 'email'])
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ])
            ->all();
    }

    /**
     * @return Collection<int, EmailPilotAllowlistEntry>
     */
    private function entries(User $actor): Collection
    {
        $this->assertCompany($actor);

        return EmailPilotAllowlistEntry::withoutGlobalScopes()
            ->with([
                'user' => fn ($query) => $query->select('id', 'name', 'email'),
                'addedBy' => fn ($query) => $query->select('id', 'name'),
            ])
            ->where('company_id', $actor->company_id)
            ->orderByRaw('user_id is null desc')
            ->orderBy('id')
            ->get();
    }

    /**
     * @return array{id: int, scope: string, user_id: int|null, user_name: string|null, user_email: string|null, added_by_id: int|null, added_by_name: string|null, created_at: string|null}
     */
    private function present(EmailPilotAllowlistEntry $entry): array
    {
        return [
            'id' => $entry->id,
            'scope' => $entry->user_id === null ? 'company' : 'user',
            'user_id' => $entry->user_id,
            'user_name' => $entry->user?->name,
            'user_email' => $entry->user?->email,
            'added_by_id' => $entry->addedBy?->id,
            'added_by_name' => $entry->addedBy?->name,
            'created_at' => $entry->created_at?->toIso8601String(),
        ];
    }

    private function assertCompany(User $actor): void
    {
        if ($actor->company_id === null) {
            throw new DomainException('no_company');
        }
    }
}
