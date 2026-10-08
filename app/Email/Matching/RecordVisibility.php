<?php

namespace App\Email\Matching;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Whether a user may see the lead or deal they want to put mail on. Fails
 * closed: anything unreadable counts as not visible, and so does a deal
 * watcher, whose email access is not signed off.
 */
class RecordVisibility
{
    public function __construct(private readonly LeadVisibility $leads) {}

    public function canSee(User $user, Model $record): bool
    {
        return match (true) {
            $record instanceof Lead => $this->leads->canSee($user, $record),
            $record instanceof Deal => $this->canSeeDeal($user, $record),
            default => false,
        };
    }

    private function canSeeDeal(User $user, Deal $deal): bool
    {
        if ($user->company_id === null || (int) $user->company_id !== (int) $deal->company_id) {
            return false;
        }

        try {
            $scope = $user->permission('view_deals');

            $added = $deal->added_by !== null && (int) $deal->added_by === (int) $user->id;

            return match ($scope) {
                'all' => true,
                'added' => $added,
                'owned' => $this->isDealAgent($user, $deal) || $this->isDealParticipant($user, $deal),
                'both' => $added || $this->isDealAgent($user, $deal) || $this->isDealParticipant($user, $deal),
                default => false,
            };
        } catch (Throwable) {
            return false;
        }
    }

    private function isDealAgent(User $user, Deal $deal): bool
    {
        if ($deal->agent_id === null) {
            return false;
        }

        return DB::table('lead_agents')
            ->where('id', $deal->agent_id)
            ->where('user_id', $user->id)
            ->exists();
    }

    /** Participants work a deal with full access, like its agent. Watchers do not count. */
    private function isDealParticipant(User $user, Deal $deal): bool
    {
        return DB::table('deal_participants')
            ->where('deal_id', $deal->id)
            ->where('user_id', $user->id)
            ->exists();
    }
}
