<?php

namespace App\Support;

use App\Models\User;

/**
 * Who may do what with calls and call recordings.
 *
 * - make calls: admins, or make_softphone_calls = all|added.
 * - manage calls: admins, or manage_calls = all. Call managers see every
 *   agent's calls (the Calls menu) and may play every recording.
 * - play a recording: the agent who made it (with make calls), or a call
 *   manager. Company and expiry are checked by the recording endpoints.
 */
final class CallAccess
{
    public static function canMakeCalls(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return $user->hasRole('admin')
            || in_array($user->permission('make_softphone_calls'), ['all', 'added'], true);
    }

    public static function canManageCalls(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return $user->hasRole('admin') || $user->permission('manage_calls') === 'all';
    }

    /** Whether $user may play a recording owned by $ownerId (company and expiry checked elsewhere). */
    public static function canPlayRecording(?User $user, ?int $ownerId): bool
    {
        if ($user === null) {
            return false;
        }

        if (self::canManageCalls($user)) {
            return true;
        }

        return self::canMakeCalls($user)
            && $ownerId !== null
            && (int) $user->id === $ownerId;
    }
}
