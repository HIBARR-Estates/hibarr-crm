<?php

namespace App\Services;

use App\Models\Property;
use App\Models\PropertyCollaborator;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class PropertyCollaboratorService
{
    /**
     * Grant or reactivate collaborator access for a user on a property.
     */
    public function grant(
        Property $property,
        int $userId,
        string $grantedVia = PropertyCollaborator::GRANTED_VIA_ACCESS_REQUEST,
        ?int $grantedBy = null,
    ): PropertyCollaborator {
        return DB::transaction(function () use ($property, $userId, $grantedVia, $grantedBy) {
            $existing = PropertyCollaborator::query()
                ->where('property_id', $property->id)
                ->where('user_id', $userId)
                ->first();

            if ($existing) {
                $existing->update([
                    'granted_at' => now(),
                    'granted_via' => $grantedVia,
                    'granted_by' => $grantedBy,
                    'revoked_at' => null,
                    'revoked_by' => null,
                ]);

                return $existing->fresh();
            }

            return PropertyCollaborator::create([
                'property_id' => $property->id,
                'user_id' => $userId,
                'granted_at' => now(),
                'granted_via' => $grantedVia,
                'granted_by' => $grantedBy,
            ]);
        });
    }

    /**
     * Revoke collaborator access.
     */
    public function revoke(Property $property, int $userId, User $revokedBy): bool
    {
        $record = PropertyCollaborator::query()
            ->where('property_id', $property->id)
            ->where('user_id', $userId)
            ->whereNull('revoked_at')
            ->first();

        if (!$record) {
            return false;
        }

        $record->update([
            'revoked_at' => now(),
            'revoked_by' => $revokedBy->id,
        ]);

        return true;
    }
}
