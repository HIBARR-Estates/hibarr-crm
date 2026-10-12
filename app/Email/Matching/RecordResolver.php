<?php

namespace App\Email\Matching;

use App\Email\Enums\LinkableType;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

/**
 * Finds the lead or deal a user names, in their own company and only if they
 * may see it. Missing, deleted, foreign and hidden records all come back the
 * same way — null — so a caller cannot tell them apart.
 */
class RecordResolver
{
    public function __construct(private readonly RecordVisibility $visibility) {}

    public function find(User $user, string $type, int $id): ?Model
    {
        $linkable = LinkableType::tryFrom($type);

        if ($linkable === null || $user->company_id === null) {
            return null;
        }

        $class = $linkable->modelClass();

        $record = $class::withoutGlobalScopes()
            ->where('company_id', $user->company_id)
            ->when($class === Lead::class, fn ($query) => $query->whereNull('deleted_at'))
            ->find($id);

        return $record !== null && $this->visibility->canSee($user, $record) ? $record : null;
    }
}
