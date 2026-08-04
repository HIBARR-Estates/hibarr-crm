<?php

namespace App\Services\Reminders;

use App\Models\Reminder;
use App\Models\User;
use Illuminate\Support\Collection;

trait BuildsUserReminderRecipients
{
    /**
     * @param  Collection<int, int|null>|array<int, int|null>  $userIds
     * @return array<int, array{type: string, id?: int|null, email?: string|null}>
     */
    protected function usersToRecipients(Collection|array $userIds): array
    {
        $uniqueUserIds = collect($userIds)->filter()->map(fn ($id) => (int) $id)->unique()->values();
        if ($uniqueUserIds->isEmpty()) {
            return [];
        }

        $emails = User::query()
            ->whereIn('id', $uniqueUserIds)
            ->pluck('email', 'id');

        $recipients = [];
        foreach ($uniqueUserIds as $userId) {
            $email = $emails->get($userId);
            if (! is_string($email) || $email === '') {
                continue;
            }
            $recipients[] = [
                'type' => Reminder::RECIPIENT_USER,
                'id' => (int) $userId,
                'email' => $email,
            ];
        }

        return $recipients;
    }
}
