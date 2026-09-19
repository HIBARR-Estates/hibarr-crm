<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\User;
use App\Scopes\ActiveScope;
use App\Support\UserTimezone;

class UserTimezoneController extends AccountBaseController
{
    /**
     * Resolved timezone (user → company → UTC) for someone in the current
     * company. Backs the meeting form's "host's timezone" button, which
     * fetches it only when clicked rather than on every form open.
     */
    public function show(int $userId)
    {
        $user = User::query()
            ->withoutGlobalScope(ActiveScope::class)
            ->where('company_id', company()->id)
            ->findOrFail($userId);

        return Reply::dataOnly([
            'timezone' => UserTimezone::resolve($user, company()),
        ]);
    }
}
