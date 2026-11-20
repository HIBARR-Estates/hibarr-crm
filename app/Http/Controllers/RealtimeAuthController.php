<?php

namespace App\Http\Controllers;

use App\Support\RealtimeNotifications;
use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;

/**
 * Channel authorization for the self-hosted realtime connection.
 *
 * The stock /broadcasting/auth cannot be used: it signs with the *default*
 * broadcaster (the legacy Pusher credentials from the pusher_settings row), and
 * routes/channels.php registers its callbacks only there. A Reverb subscription
 * signed with the wrong secret is rejected, so this endpoint signs with the
 * realtime connection's own secret and authorizes exactly one channel: the
 * caller's own notification channel.
 */
class RealtimeAuthController extends Controller
{
    public function authorizeChannel(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! RealtimeNotifications::enabled()) {
            abort(403);
        }

        $request->validate([
            'socket_id' => ['required', 'string', 'regex:/^\d+\.\d+$/'],
            'channel_name' => ['required', 'string'],
        ]);

        $channel = (string) $request->input('channel_name');

        if ($channel !== 'private-'.RealtimeNotifications::channelFor((int) $user->id)) {
            abort(403);
        }

        $broadcaster = Broadcast::connection(RealtimeNotifications::connection());

        if (! $broadcaster instanceof PusherBroadcaster) {
            abort(503);
        }

        $signed = $broadcaster->getPusher()->authorizeChannel($channel, (string) $request->input('socket_id'));

        return response()->json(is_string($signed) ? json_decode($signed, true) : $signed);
    }
}
