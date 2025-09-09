<?php

namespace App\Traits;

use App\Models\Deal;
use App\Models\Lead;
use App\Models\DealFollowUp;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use App\Models\User;

trait DealAutomationTrait
{
    protected function triggerFollowUpAutomation(DealFollowUp $followUp, bool $async = true): ?array
    {
        try {
            // Ensure the deal is loaded
            if ($followUp->deal_id && !$followUp->deal) {
                $followUp->load('deal');
            }

            $agentInfo = $this->getAgentInformation($followUp->deal);
            $watcherInfo = $this->getWatcherInformation($followUp->deal);

            $result = $this->sendFollowUpAutomationWebhook('followup', [
                'followUpInformation' => [
                    'id' => $followUp->id,
                    'deal_id' => $followUp->deal_id,
                    'meeting_type' => $followUp->meetingType ? $followUp->meetingType->name : null,
                    'meeting_type_id' => $followUp->meeting_type_id,
                    'location' => $followUp->location,
                    'meeting_link' => $followUp->meeting_link,
                    'next_follow_up_date' => $followUp->next_follow_up_date?->format('Y-m-d H:i:s'),
                    'remark' => $followUp->remark,
                    'status' => $followUp->status,
                    'created_at' => $followUp->created_at->format('Y-m-d H:i:s'),
                ],
                'dealInformation' => $followUp->deal ? $followUp->deal->toArray() : null,
                'contactInformation' => $followUp->deal ? $this->getCustomerInfo($followUp->deal->lead_id) : null,
                'agentInformation' => $agentInfo,
                'watcherInformation' => $watcherInfo,
            ]);

            Log::info("Follow-up automation triggered successfully", [
                'follow_up_id' => $followUp->id,
                'deal_id' => $followUp->deal_id,
                'meeting_type' => $followUp->meetingType ? $followUp->meetingType->name : null,
                'n8n_response' => $result,
            ]);

            return $result;

        } catch (\Exception $e) {
            Log::error("Failed to trigger follow-up automation", [
                'follow_up_id' => $followUp->id,
                'deal_id' => $followUp->deal_id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    private function sendFollowUpAutomationWebhook(string $type, array $payload): array
    {
        $url = config("app.automations.followups.followup_webhook_url");
        
        \Log::info('Webhook configuration check', [
            'url' => $url,
            'type' => $type,
            'payload_keys' => array_keys($payload)
        ]);
        
        if (!$url) {
            \Log::error('Webhook URL not configured', ['type' => $type]);
            throw new \Exception("Follow-up automation webhook URL not configured for type: {$type}");
        }

        \Log::info('Making webhook request', [
            'url' => $url,
            'payload_size' => strlen(json_encode($payload))
        ]);

        try {
            $client = new Client([
                'timeout' => false, // No timeout for testing
                'connect_timeout' => 15,
                'verify' => false,
            ]);

            $response = $client->post($url, [
                'json' => $payload,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'User-Agent' => 'Hibarr-CRM/1.0',
                    'Accept' => 'application/json',
                ],
            ]);

            $statusCode = $response->getStatusCode();
            $responseBody = $response->getBody()->getContents();
            
            \Log::info('Webhook response received', [
                'status_code' => $statusCode,
                'response_body' => $responseBody,
                'response_length' => strlen($responseBody)
            ]);
            
            if ($statusCode < 200 || $statusCode >= 300) {
                \Log::error('Webhook returned error status', [
                    'status_code' => $statusCode,
                    'response_body' => $responseBody
                ]);
                throw new \Exception("Webhook returned non-success status code: {$statusCode}. Response: {$responseBody}");
            }

            // Handle empty response (n8n might return empty response on success)
            if (empty($responseBody)) {
                $result = ['status' => 'success'];
            } else {
                $result = json_decode($responseBody, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    throw new \Exception("Invalid JSON response from webhook: " . json_last_error_msg() . ". Raw response: {$responseBody}");
                }

                // Validate that we got a proper response
                if (!isset($result['status']) || $result['status'] !== 'success') {
                    throw new \Exception("Webhook did not return success status. Response: " . json_encode($result));
                }
            }

            // For online meetings, require meeting_link in response
            if (isset($payload['followUpInformation']['location']) && 
                $payload['followUpInformation']['location'] !== 'office' && 
                (!isset($result['meeting_link']) || empty($result['meeting_link']))) {
                throw new \Exception("Meeting link is required for online meetings but was not provided in webhook response");
            }

            // Handle meeting link from webhook response
            if (isset($result['meeting_link']) && !empty($result['meeting_link'])) {
                $this->updateFollowUpMeetingLink($payload['followUpInformation']['id'], $result['meeting_link']);
            }

            return $result;

        } catch (\GuzzleHttp\Exception\ConnectException $e) {
            $error = "Failed to connect to webhook URL: " . $e->getMessage();
            Log::error($error, ['exception' => $e, 'url' => $url]);
            throw new \Exception($error, 0, $e);
        } catch (\GuzzleHttp\Exception\RequestException $e) {
            $error = "Webhook request failed: " . $e->getMessage();
            Log::error($error, ['exception' => $e, 'url' => $url]);
            throw new \Exception($error, 0, $e);
        } catch (\Throwable $e) {
            $error = "Unexpected error sending follow-up automation webhook: " . $e->getMessage();
            Log::error($error, ['exception' => $e, 'url' => $url]);
            throw new \Exception($error, 0, $e);
        }
    }

    private function getAgentInformation(?Deal $deal): ?array
    {
        if (!$deal || !$deal->agent_id) {
            return null;
        }

        try {
            $leadAgent = \App\Models\LeadAgent::find($deal->agent_id);
            if (!$leadAgent) {
                return null;
            }

            $user = \App\Models\User::find($leadAgent->user_id);
            if (!$user) {
                return null;
            }

            return [
                'agent_id' => $leadAgent->id,
                'user_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'mobile' => $user->mobile,
                'status' => $user->status,
                'role' => $user->role ? (is_object($user->role) && method_exists($user->role, 'first') ? $user->role->first()?->display_name : $user->role->display_name) : null,
                'category_id' => $leadAgent->lead_category_id,
                'category_name' => $leadAgent->lead_category_id ? \App\Models\LeadCategory::find($leadAgent->lead_category_id)?->category_name : null,
            ];
        } catch (\Throwable $e) {
            Log::error("Failed to get agent information for deal ID: {$deal->id}", ['exception' => $e, 'agent_id' => $deal->agent_id]);
            return null;
        }
    }

    private function getWatcherInformation(?Deal $deal): ?array
    {
        if (!$deal || !$deal->deal_watcher) {
            return null;
        }

        try {
            $user = \App\Models\User::find($deal->deal_watcher);
            if (!$user) {
                return null;
            }

            return [
                'watcher_id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'mobile' => $user->mobile,
                'status' => $user->status,
                'role' => $user->role ? (is_object($user->role) && method_exists($user->role, 'first') ? $user->role->first()?->display_name : $user->role->display_name) : null,
            ];
        } catch (\Throwable $e) {
            Log::error("Failed to get watcher information for deal ID: {$deal->id}", ['exception' => $e, 'deal_watcher' => $deal->deal_watcher]);
            return null;
        }
    }

    /**
     * Trigger automation for deal creation
     */
    protected function triggerDealCreationAutomation(Request $request, bool $async = true): ?array
    {
        $validatedData = $request->validate([
            'lead_contact' => 'nullable|integer|exists:leads,id',
            // Add other expected fields here
        ]);

        // if ($async) {
        //     $this->dispatchDealAutomationJob('create', 0, $validatedData);
        //     return null;
        // }

        return $this->sendAutomationWebhook('create', [
            'contactInformation' => $this->getCustomerInfo($validatedData['lead_contact'] ?? null),
            'dealCustomFields'     => $validatedData,
            'agentInformation' => $this->getAgentInformation($followUp->deal),
            'watcherInformation' => $this->getWatcherInformation($followUp->deal),
        ]);
    }

    private static function getExcludedDealUpdateFields(): array
    {
        return [
            'f_email',
            'f_slack_username', 
            'redirect_url',
            '_token',
            '_method',
            'name',
            'pipeline',
            'stage_id',
            'category_id',
            'agent_id',
            'value',
            'close_date',
            'deal_watcher',
        ];
    }
  
    protected function triggerDealUpdateAutomation(Request $request, Deal $deal, bool $async = true): ?array
    {
        // if ($async) {
        //     $this->dispatchDealAutomationJob('update', $deal->id, $request->all());
        //     return null;
        // }

            $filteredRequest = collect($request->all())->except(self::getExcludedDealUpdateFields())->toArray();

        return $this->sendAutomationWebhook('update', [
            'contactInformation' => $this->getCustomerInfo($deal->lead_id),
            'dealInformation' => $deal->toArray(),
            'dealCustomFields' => $filteredRequest['custom_fields_data'] ?? [],
        ]);
    }

    protected function triggerDealMoveAutomation( Deal $deal, bool $async = true): ?array
    {
        return $this->sendAutomationWebhook('update', [
            'contactInformation' => $this->getCustomerInfo($deal->lead_id),
            'dealInformation' => $deal->toArray(),
            'dealCustomFields' => $this->extractDealCustomFieldsData($deal),
        ]);
    }

  
    private function sendAutomationWebhook(string $type, array $payload): ?array
    {
        try {
            $url = config("app.automations.deals.{$type}_webhook_url");
            
            if (!$url) {
                Log::warning("Automation webhook URL not configured for type: {$type}");
                return null;
            }

            $client = new Client([
                'timeout' => 10,
                'connect_timeout' => 5,
            ]);

            $response = $client->post($url, [
                'json' => $payload,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'User-Agent' => 'Hibarr-CRM/1.0',
                ],
            ]);

            $result = json_decode($response->getBody(), true);
            
            Log::info("Automation webhook sent successfully", [
                'type' => $type,
                'url' => $url,
                'status_code' => $response->getStatusCode(),
            ]);

            return $result;

        } catch (\Throwable $e) {
            Log::error("Automation webhook failed for type: {$type}", [
                'exception' => $e,
                'trace' => $e->getTraceAsString(),
                'url' => $url ?? 'not configured',
            ]);

            return null;
        }
    }


   
    private function dispatchDealAutomationJob(string $type, int $dealId, array $requestData): void
    {
        try {
            \App\Jobs\DealAutomationJob::dispatch($type, $dealId, $requestData);
        } catch (\Throwable $e) {
            Log::error("Failed to dispatch deal automation job", [
                'type' => $type,
                'deal_id' => $dealId,
                'exception' => $e,
            ]);
        }
    }


    private function updateFollowUpMeetingLink(int $followUpId, string $meetingLink): void
    {
        try {
            $followUp = DealFollowUp::find($followUpId);
            if ($followUp) {
                $followUp->meeting_link = $meetingLink;
                $followUp->save();
                
                Log::info("Meeting link updated from webhook response", [
                    'follow_up_id' => $followUpId,
                    'meeting_link' => $meetingLink,
                ]);
            }
        } catch (\Exception $e) {
            Log::error("Failed to update meeting link from webhook response", [
                'follow_up_id' => $followUpId,
                'meeting_link' => $meetingLink,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function getCustomerInfo(?int $leadId): array
    {
        if (!$leadId) {
            return [
                'leadContact' => null,
                'leadContactCustomFields' => [],
            ];
        }

        try {
            $leadContact = Lead::findOrFail($leadId)->withCustomFields();
            
            $customFieldsData = $this->extractCustomFieldsData($leadContact);

            return [
                'leadContact' => [
                    'id' => $leadContact->id,
                    'client_name' => $leadContact->client_name,
                    'client_email' => $leadContact->client_email,
                    'mobile' => $leadContact->mobile,
                    'cell' => $leadContact->cell,
                    'office' => $leadContact->office,
                    'company_name' => $leadContact->company_name,
                    'website' => $leadContact->website,
                    'address' => $leadContact->address,
                    'city' => $leadContact->city,
                    'state' => $leadContact->state,
                    'country' => $leadContact->country,
                    'postal_code' => $leadContact->postal_code,
                    'note' => $leadContact->note,
                    'value' => $leadContact->value,
                    'total_value' => $leadContact->total_value,
                    'currency_id' => $leadContact->currency_id,
                    'category_id' => $leadContact->category_id,
                    'source_id' => $leadContact->source_id,
                    'status_id' => $leadContact->status_id,
                    'agent_id' => $leadContact->agent_id,
                    'added_by' => $leadContact->added_by,
                    'last_updated_by' => $leadContact->last_updated_by,
                    'created_at' => $leadContact->created_at?->format('Y-m-d H:i:s'),
                    'updated_at' => $leadContact->updated_at?->format('Y-m-d H:i:s'),
                ],
                'leadContactCustomFields' => $customFieldsData,
            ];
        } catch (\Throwable $e) {
            Log::error("Failed to get customer info for lead ID: {$leadId}", [
                'exception' => $e,
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'leadContact' => null,
                'leadContactCustomFields' => [],
            ];
        }
    }

    private function extractCustomFieldsFromModel($model, string $modelType): array
    {
        try {
            $customFieldsData = [];
            $getCustomFieldGroupsWithFields = $model->getCustomFieldGroupsWithFields();
            
            if ($getCustomFieldGroupsWithFields && isset($getCustomFieldGroupsWithFields->fields)) {
                foreach ($getCustomFieldGroupsWithFields->fields as $field) {
                    if (isset($field['name'])) {
                        $customFieldsData[$field['name']] = $field['value'] ?? null;
                    }
                }
            }

            return $customFieldsData;

        } catch (\Throwable $e) {
            Log::error("Failed to extract custom fields data from {$modelType}", [
                'exception' => $e,
                'id' => $model->id,
            ]);

            return [];
        }
    }

    private function extractCustomFieldsData(Lead $leadContact): array
    {
        return $this->extractCustomFieldsFromModel($leadContact, 'lead');
    }

    private function geDealCustomFieldsData(Deal $deal): array
    {
        return $this->extractCustomFieldsFromModel($deal, 'deal');
    }
}               