<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

// New-message signals for one user (App\Events\NewChatEvent, NewMentionChatEvent).
Broadcast::channel('messages.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Note: the private `notifications.{userId}` channel (App\Events\UserNotificationCreated /
// UserNotificationsRead) is deliberately NOT declared here. It lives on the self-hosted
// realtime connection and is authorized by App\Http\Controllers\RealtimeAuthController,
// because this file's callbacks belong to the default (legacy Pusher) connection.

// One conversation, lowest user id first (App\Events\NewMessage::conversationChannel),
// also used for typing whispers. Only its two participants may join, and only when
// both belong to the same company.
Broadcast::channel('chat.{userOne}.{userTwo}', function ($user, $userOne, $userTwo) {
    $participants = [(int) $userOne, (int) $userTwo];

    if (!in_array((int) $user->id, $participants, true)) {
        return false;
    }

    $otherId = (int) $user->id === $participants[0] ? $participants[1] : $participants[0];

    return User::withoutGlobalScopes()
        ->whereKey($otherId)
        ->where('company_id', $user->company_id)
        ->exists();
});
