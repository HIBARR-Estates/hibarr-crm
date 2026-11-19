<?php

namespace App\Support;

/**
 * Single place that answers "is realtime notification delivery configured?"
 * and what the browser is allowed to know about it.
 */
final class RealtimeNotifications
{
    /**
     * Server side: broadcast only when the env kill switch is on AND the pinned
     * connection is complete. An incomplete connection would make the Pusher
     * client throw on every notification, so treat it as off.
     */
    public static function enabled(): bool
    {
        if (! config('realtime.notifications.enabled')) {
            return false;
        }

        $connection = config('broadcasting.connections.'.self::connection());

        return is_array($connection)
            && filled($connection['key'] ?? null)
            && filled($connection['secret'] ?? null)
            && filled($connection['app_id'] ?? null)
            && filled($connection['options']['host'] ?? null);
    }

    public static function connection(): string
    {
        return (string) config('realtime.notifications.connection', 'reverb');
    }

    /** The private channel one user's notification events go to (authorized in RealtimeAuthController). */
    public static function channelFor(int $userId): string
    {
        return 'notifications.'.$userId;
    }

    /**
     * The `realtime` Inertia prop: public connection details, or null when the
     * browser should not even try. Never includes the secret or the app id.
     *
     * @return array{key: string, host: string, port: int, scheme: string, authEndpoint: string}|null
     */
    public static function clientConfig(): ?array
    {
        if (! self::enabled()) {
            return null;
        }

        $client = (array) config('realtime.client', []);

        if (blank($client['key'] ?? null) || blank($client['host'] ?? null)) {
            return null;
        }

        return [
            'key' => (string) $client['key'],
            'host' => (string) $client['host'],
            'port' => (int) ($client['port'] ?? 443),
            'scheme' => (string) ($client['scheme'] ?? 'https'),
            'authEndpoint' => route('realtime.auth', [], false),
        ];
    }
}
