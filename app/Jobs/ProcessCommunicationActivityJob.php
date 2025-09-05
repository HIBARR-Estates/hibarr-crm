<?php

namespace App\Jobs;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use App\Notifications\NewCommunicationActivity;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessCommunicationActivityJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected array $normalizedData;

    /**
     * Create a new job instance.
     */
    public function __construct(array $normalizedData)
    {
        $this->normalizedData = $normalizedData;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        // Create the communication activity record
        $activity = CommunicationActivity::create($this->normalizedData);

        // Notify relevant users
        if (!empty($activity->deal_id)) {
            $deal = Deal::with('leadAgent.user', 'dealWatcher', 'addedBy')->find($activity->deal_id);

            $notifiables = collect();

            // Lead agent
            if ($deal && $deal->leadAgent && $deal->leadAgent->user) {
                $notifiables->push($deal->leadAgent->user);
            }

            // Deal watcher
            if ($deal && $deal->dealWatcher) {
                $notifiables->push($deal->dealWatcher);
            }

            // Deal creator
            // if ($deal && $deal->addedBy) {
            //     $notifiables->push($deal->addedBy);
            // }

            // Remove duplicates and nulls
            $notifiables = $notifiables->filter()->unique('id');

            foreach ($notifiables as $user) {
                $user->notify(new NewCommunicationActivity($activity, $deal));
            }
        } elseif (!empty($activity->lead_id)) {
            $lead = Lead::with('leadAgent.user', 'addedBy', 'leadOwner')->find($activity->lead_id);

            $notifiables = collect();

            // Lead agent
            if ($lead && $lead->leadAgent && $lead->leadAgent->user) {
                $notifiables->push($lead->leadAgent->user);
            }

            // Lead owner
            if ($lead && $lead->leadOwner) {
                $notifiables->push($lead->leadOwner);
            }

            // Lead creator
            if ($lead && $lead->addedBy) {
                $notifiables->push($lead->addedBy);
            }

            // Remove duplicates and nulls
            $notifiables = $notifiables->filter()->unique('id');

            foreach ($notifiables as $user) {
                $user->notify(new NewCommunicationActivity($activity, $lead));
            }
        }
    }
}