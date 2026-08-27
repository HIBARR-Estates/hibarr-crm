<?php

namespace App\Services;

use App\Models\EmailNotificationSetting;
use Illuminate\Database\Eloquent\Collection;
use InvalidArgumentException;

/**
 * Shared save/read logic for the per-type notification channel toggles
 * (email / slack / push / database), used by both the legacy Blade settings
 * controllers and the React notification-settings API.
 */
class NotificationSettingsService
{
    /**
     * Maps the public "channel" name (used in URLs/requests) to its column
     * on email_notification_settings. Whitelisted deliberately — never resolve
     * a column name from raw client input.
     *
     * @var array<string, string>
     */
    public const CHANNEL_COLUMNS = [
        'email' => 'send_email',
        'slack' => 'send_slack',
        'push' => 'send_push',
        'database' => 'send_database',
    ];

    public function getAllSettings(): Collection
    {
        return EmailNotificationSetting::all();
    }

    public function columnForChannel(string $channel): string
    {
        if (! isset(self::CHANNEL_COLUMNS[$channel])) {
            throw new InvalidArgumentException("Unknown notification channel [{$channel}].");
        }

        return self::CHANNEL_COLUMNS[$channel];
    }

    /**
     * Reset every row's $column to 'no', then set it to 'yes' for the given ids.
     * Relies on EmailNotificationSetting's HasCompany global scope for company
     * isolation, same as the existing per-channel controllers.
     *
     * @param  array<int, int|string>  $enabledIds
     */
    public function updateChannelToggles(string $column, array $enabledIds): void
    {
        if (! in_array($column, self::CHANNEL_COLUMNS, true)) {
            throw new InvalidArgumentException("Unknown notification setting column [{$column}].");
        }

        EmailNotificationSetting::where($column, 'yes')->update([$column => 'no']);

        if ($enabledIds !== []) {
            EmailNotificationSetting::whereIn('id', $enabledIds)->update([$column => 'yes']);
        }
    }
}
