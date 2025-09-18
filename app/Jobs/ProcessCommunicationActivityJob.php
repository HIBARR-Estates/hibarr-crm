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

    
    protected CommunicationActivity $activity;

    /**
     * Create a new job instance.
     */
    public function __construct(CommunicationActivity $activity)
    {
        $this->activity = $activity;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        
        $activity = $this->activity;

        // TODO: Add logs to all step processes for communication activity processing
        // TODO: Write tests for all case scenarios

        // check if activity is linked to a deal or lead
        if (empty($activity->deal_id) && empty($activity->lead_id)) {
            return;
        }
    

        $notifiables = collect();
        // Notify relevant users
        if (!empty($activity->deal_id)) {
            $deal = Deal::with('leadAgent.user', 'dealWatcher', 'addedBy')->find($activity->deal_id);


            // Lead agent
            if ($deal && $deal?->leadAgent && $deal?->leadAgent->user) {
                $notifiables->push($deal?->leadAgent->user);
            }

            // Deal watcher
            if ($deal && $deal?->dealWatcher) {
                $notifiables->push($deal?->dealWatcher);
            }


              // Lead owner(should only be notified if this is the first communication activity on a deal)
            $isFirstActivity = $deal->communicationActivities()->count() === 0;
            if ($deal && $deal->lead?->leadOwner && $isFirstActivity) {
                $notifiables->push($deal->lead?->leadOwner);
            }

            // Deal creator
            // if ($deal && $deal->addedBy) {
            //     $notifiables->push($deal->addedBy);
            // }

            $dealOrLead = $deal;

           
        } elseif (!empty($activity->lead_id)) {
            $lead = Lead::find($activity->lead_id);

            if( !$lead ) {
                return;
            }
            // get all deals connected to this lead
            $deals = Deal::where('lead_id', $activity->lead_id)->with([
                'leadAgent.user', 'dealWatcher', 'addedBy'
            ])->get();

            $notifiables = collect();

            // notify the deal watchers and the lead agent on the deals connected to this lead
            if ($deals) {
                foreach ($deals as $deal) {
                    // Deal watcher
                    if ($deal?->dealWatcher) {
                        $notifiables->push($deal?->dealWatcher);
                    }

                    // Lead agent
                    if ($deal?->leadAgent && $deal?->leadAgent?->user) {
                        $notifiables->push($deal?->leadAgent?->user);
                    }
                }
            }

          

            // Lead creator
            // if ($lead && $lead->addedBy) {
            //     $notifiables->push($lead->addedBy);
            // }

            $dealOrLead = $lead;
        
        }

         // Remove duplicates and nulls
        $notifiables = $notifiables->filter()->unique('id');

        foreach ($notifiables as $user) {
            $user->notify(new NewCommunicationActivity($activity, $dealOrLead));
        }
    }
}