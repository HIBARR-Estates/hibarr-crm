<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Services\CommunicationActivityResolverService;
use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use App\Enums\ResolutionStatus;
use App\Mail\CustomerCommunicationEmail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ResolveCommunicationActivityJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;


    // Exponential backoff for retries & try at least 3 times before marking as unresolved
        /**
     * The number of times the job may be attempted.
     */
    public $tries = 3;

    /**
     * The maximum number of unhandled exceptions to allow before failing.
     */
    public $maxExceptions = 3;

    /**
     * Calculate the number of seconds to wait before retrying the job.
     */
    public function backoff(): array
    {
        return [
            60,      // First retry after 1 minute
            300,     // Second retry after 5 minutes  
            900,     // Third retry after 15 minutes
        ];
    }

    protected int $activityId;
    protected int $maxResolutionAttempts = 3;
    protected bool $can_create_deal = true; 

    /**
     * Create a new job instance.
     */
    public function __construct(int $activityId, bool $can_create_deal = true)
    {
        $this->activityId = $activityId;
        $this->can_create_deal = $can_create_deal;

        // Set queue to resolvers for better organization
        $this->onQueue('resolvers');
    }

    /**
     * Execute the job.
     */
    public function handle(CommunicationActivityResolverService $resolver): void
    {
        $activity = CommunicationActivity::find($this->activityId);

        if (!$activity) {
            return;
        }

        // Increment resolution attempts and update timestamp
        $activity->resolution_attempts = ($activity->resolution_attempts ?? 0) + 1;
        $activity->last_resolution_attempt_at = now();

        try {
            // For outbound emails with deal_id already set, skip resolution and mark as resolved immediately
            $direction = $activity->metadata['direction'] ?? null;
            $hasDealId = !empty($activity->deal_id);
            $channelType = $activity->channel_type;
            
            if ($direction === 'outbound' && $hasDealId && $channelType === 'email') {
                // Outbound email from modal with deal_id - resolve immediately
                $activity->resolution_status = ResolutionStatus::Resolved->value;
                $activity->save();
                $this->sendResolvedEmail($activity);
                return;
            }
            
            // Attempt to resolve
            $resolver->resolve($activity);
            
            // Refresh activity to get latest deal_id/lead_id after resolution
            $activity->refresh();
                
            if($this->can_create_deal && empty($activity->deal_id) && isset($activity->lead_id)) {
                $resolver->createDealIfNeeded($activity);
                $activity->refresh(); // Refresh again after deal creation
            }

            // Check if resolution was successful
            if (!empty($activity->deal_id) || !empty($activity->lead_id)) {
                $activity->resolution_status = ResolutionStatus::Resolved->value;
                $activity->save();
                
                // Only send email for outbound activities (user-initiated emails)
                // Inbound emails can also have deal_id set by the resolver, so we must check direction explicitly
                $direction = $activity->metadata['direction'] ?? null;
                $isOutbound = $direction === 'outbound';
                
                if ($isOutbound && $activity->channel_type === 'email') {
                    $this->sendResolvedEmail($activity);
                }
                return;
            }

            // If still not resolved after max attempts, mark as unresolved
            if ($activity->resolution_attempts >= $this->maxResolutionAttempts) {
                $activity->resolution_status = ResolutionStatus::Unresolved->value;
                $activity->save();
                return;
            }

            // If not at max attempts yet, throw exception to trigger retry
            throw new \Exception("Resolution attempt {$activity->resolution_attempts} failed. Will retry.");

        } catch (\Exception $e) {
            $activity->save(); // Save attempt count even on failure
            
            // If we've reached max attempts, mark as unresolved and don't retry
            if ($activity->resolution_attempts >= $this->maxResolutionAttempts) {
                $activity->resolution_status = ResolutionStatus::Unresolved->value;
                $activity->save();
                
                // Don't retry - let the job fail silently
                $this->fail($e);
                return;
            }

            // Re-throw to trigger retry mechanism
            throw $e;
        }        
    }

     /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        $activity = CommunicationActivity::find($this->activityId);
        
        if ($activity) {
            $activity->resolution_status = ResolutionStatus::Unresolved->value;
            $activity->save();
        }

        Log::error('ResolveCommunicationActivityJob failed', [
            'activity_id' => $this->activityId,
            'attempts' => $activity?->resolution_attempts ?? 0,
            'error' => $exception->getMessage()
        ]);
    }

    /**
     * Send email template to customer when activity is resolved.
     *
     * @param CommunicationActivity $activity
     * @return void
     */
    private function sendResolvedEmail(CommunicationActivity $activity): void
    {
        try {
            $dealOrLead = null;
            $customerEmail = null;
            
            // Get deal or lead
            if (!empty($activity->deal_id)) {
                $dealOrLead = Deal::with('contact', 'leadAgent.user', 'company')->find($activity->deal_id);
                if ($dealOrLead) {
                    // Check if contact exists and has email
                    if ($dealOrLead->contact && !empty($dealOrLead->contact->client_email)) {
                        $customerEmail = $dealOrLead->contact->client_email;
                    } else {
                        // Try to get email from activity metadata or email field
                        $customerEmail = $activity->email ?? $activity->metadata['email'] ?? null;
                        
                        if (!$customerEmail) {
                            Log::error('Cannot send email - deal has no contact email', [
                                'activity_id' => $activity->id,
                                'deal_id' => $activity->deal_id,
                                'has_contact' => $dealOrLead->contact ? 'yes' : 'no'
                            ]);
                            return;
                        }
                    }
                }
            } elseif (!empty($activity->lead_id)) {
                $dealOrLead = Lead::with('company')->find($activity->lead_id);
                if ($dealOrLead) {
                    $customerEmail = $dealOrLead->client_email ?? $activity->email ?? null;
                    
                    if (!$customerEmail) {
                        Log::error('Cannot send email - lead has no email address', [
                            'activity_id' => $activity->id,
                            'lead_id' => $activity->lead_id,
                        ]);
                        return;
                    }
                }
            }
            
            // Check if we have a valid customer email
            if (!$dealOrLead || !$customerEmail) {
                Log::error('Cannot send email - missing deal/lead or customer email', [
                    'activity_id' => $activity->id,
                    'deal_id' => $activity->deal_id,
                    'lead_id' => $activity->lead_id,
                    'has_deal_or_lead' => $dealOrLead ? 'yes' : 'no',
                ]);
                return;
            }
            
            // Determine sender
            // PRIORITY: Always check sender_info first (for both inbound and outbound)
            // The sender_info contains the contact email that the resolver found the LeadAgent for
            $sender = null;
            
            // Check sender_info first (regardless of direction)
            $senderInfo = $activity->sender_info ?? [];
            $senderEmail = $senderInfo['contact'] ?? $senderInfo['email'] ?? null;
            
            if ($senderEmail) {
                // Find the User by the contact email
                $userFromContact = User::where('email', $senderEmail)
                    ->where('company_id', $activity->company_id)
                    ->first();
                
                if ($userFromContact) {
                    // Find the LeadAgent for this user
                    $leadAgentFromContact = \App\Models\LeadAgent::where('user_id', $userFromContact->id)->first();
                    
                    if ($leadAgentFromContact && $leadAgentFromContact->user) {
                        $sender = User::with('employeeDetail.designation')
                            ->where('id', $leadAgentFromContact->user->id)
                            ->first();
                    } else {
                        // If no LeadAgent, use the user directly
                        $sender = User::with('employeeDetail.designation')
                            ->where('id', $userFromContact->id)
                            ->first();
                    }
                }
            }
            
            // Fallback: Try lead agent or company admin
            if (!$sender) {
                if ($dealOrLead instanceof Deal && $dealOrLead->leadAgent && $dealOrLead->leadAgent->user) {
                    $sender = User::with('employeeDetail.designation')->find($dealOrLead->leadAgent->user->id);
                } else {
                    // Fallback to first company admin
                    $companyId = $dealOrLead->company_id ?? $activity->company_id;
                    if ($companyId) {
                        $admins = User::allAdmins($companyId);
                        $admin = $admins->first();
                        if ($admin) {
                            $sender = User::with('employeeDetail.designation')->find($admin->id);
                        }
                    }
                }
            }
            
            if (!$sender) {
                Log::error('Cannot send email - no sender found', [
                    'activity_id' => $activity->id,
                ]);
                return;
            }
            
            // Prepare email content
            $subject = $activity->subject ?? __('email.communicationActivity.resolved.subject', ['name' => config('app.name')]);
            $emailContent = (string) ($activity->message_content ?? __('email.communicationActivity.resolved.message'));
            
            // Send the email using Mail facade
            Mail::to($customerEmail)->send(
                new CustomerCommunicationEmail(
                    $activity,
                    $dealOrLead,
                    $sender,
                    $subject,
                    $emailContent,
                    []
                )
            );
            
        } catch (\Exception $e) {
            Log::error('Failed to send email template after activity resolution', [
                'activity_id' => $activity->id,
                'error' => $e->getMessage()
            ]);
            // Don't throw - email failure shouldn't break the resolution process
        }
    }

}