<?php

namespace App\Traits;

use App\Models\Deal;
use App\Models\Lead;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;

trait DealAutomationTrait
{
    /**
     * Trigger automation for deal creation
     *
     * @param Request $request
     * @param bool $async
     * @return array|null
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
        ]);
    }
    private const EXCLUDED_DEAL_UPDATE_FIELDS = [
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
    /**
     * Trigger automation for deal updates
     *
     * @param Request $request
     * @param Deal $deal
     * @param bool $async
     * @return array|null
     */
    protected function triggerDealUpdateAutomation(Request $request, Deal $deal, bool $async = true): ?array
    {
        // if ($async) {
        //     $this->dispatchDealAutomationJob('update', $deal->id, $request->all());
        //     return null;
        // }

            $filteredRequest = collect($request->all())->except(self::EXCLUDED_DEAL_UPDATE_FIELDS)->toArray();

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

    /**
     * Send automation webhook
     *
     * @param string $type
     * @param array $payload
     * @return array|null
     */
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
            $body = $response->getBody()->getContents();
            $result = ! empty($body) ? json_decode($body, true) : null;

            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::warning("Invalid JSON response from webhook", [
                    'type'       => $type,
                    'json_error' => json_last_error_msg(),
                ]);
                return null;
            }

            Log::info("Automation webhook sent successfully", [
                'type'        => $type,
                'url'         => $url,
                'status_code' => $response->getStatusCode(),
            ]);

            return $result;                'status_code' => $response->getStatusCode(),
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

    /**
     * Dispatch automation job asynchronously
     *
     * @param string $type
     * @param int $dealId
     * @param array $requestData
     * @return void
     */
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

    /**
     * Get customer information for automation
     *
     * @param int|null $leadId
     * @return array
     */
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
                    'client_name_salutation' => $leadContact->client_name_salutation,
                    'client_email' => $leadContact->client_email,
                    'mobile' => $leadContact->mobile,
                    'office_phone' => $leadContact->office_phone,
                    'website' => $leadContact->website,
                    'address' => $leadContact->address,
                    'state' => $leadContact->state,
                    'city' => $leadContact->city,
                    'postal_code' => $leadContact->postal_code,
                    'country' => $leadContact->country,
                    'company_name' => $leadContact->company_name,
                    'client_id' => $leadContact->client_id,
                    'status' => $leadContact->status,
                    'source' => $leadContact->source,
                    'note' => $leadContact->note,
                    'created_at' => $leadContact->created_at,
                    'updated_at' => $leadContact->updated_at,
                ],
                'leadContactCustomFields' => $customFieldsData,
            ];

        } catch (\Throwable $e) {
            Log::error("Failed to get customer info for lead ID: {$leadId}", [
                'exception' => $e,
            ]);

            return [
                'leadContact' => null,
                'leadContactCustomFields' => [],
            ];
        }
    }

    /**
     * Extract custom fields data from any model with custom fields
     *
     * @param \Illuminate\Database\Eloquent\Model $model
     * @param string $modelType For logging purposes
     * @return array
     */
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

    /**
     * Extract custom fields data from lead contact
     *
     * @param Lead $leadContact
     * @return array
     */
    private function extractCustomFieldsData(Lead $leadContact): array
    {
        return $this->extractCustomFieldsFromModel($leadContact, 'lead');
    }

    /**
     * Extract custom fields data from deal
     *
     * @param Deal $deal
     * @return array
     */
    private function extractDealCustomFieldsData(Deal $deal): array
    {
        return $this->extractCustomFieldsFromModel($deal, 'deal');
    }
}                 'exception' => $e,
                'deal_id' => $deal->id,
            ]);

            return [];
        }
    }
} 