<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserNotificationBypass;

class NotificationBypass
{
    public const FLAG = 'crm.notification-bypass';

    public static function shouldSuppress(mixed $notifiable, object $notification): bool
    {
        if (! FeatureFlags::enabled(self::FLAG)) {
            return false;
        }

        if (! $notifiable instanceof User) {
            return false;
        }

        $key = class_basename($notification);

        if (! NotificationBypassCatalog::isBypassable($key)) {
            return false;
        }

        return self::isBypassed((int) $notifiable->id, $key);
    }

    public static function isBypassed(int $userId, string $key): bool
    {
        return UserNotificationBypass::query()
            ->where('user_id', $userId)
            ->where('notification_key', $key)
            ->exists();
    }

    /**
     * @return list<string>
     */
    public static function keysForUser(int $userId): array
    {
        return UserNotificationBypass::query()
            ->where('user_id', $userId)
            ->pluck('notification_key')
            ->all();
    }
}
