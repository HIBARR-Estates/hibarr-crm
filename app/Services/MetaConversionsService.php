<?php

namespace App\Services;

use App\Models\Deal;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Service to send conversion events to Meta (Facebook) Conversions API
 * 
 * This service handles the communication with Meta's Conversions API
 * to track deal stage changes as conversion events.
 */
class MetaConversionsService
{
    /**
     * Meta Pixel ID from environment configuration
     */
    protected ?string $pixelId;

    /**
     * Meta Access Token from environment configuration
     */
    protected ?string $accessToken;

    /**
     * Meta API version
     */
    protected string $apiVersion;

    /**
     * Initialize service with environment configuration
     */
    public function __construct()
    {
        $this->pixelId = config('services.meta.pixel_id') ?? env('META_PIXEL_ID');
        $this->accessToken = config('services.meta.access_token') ?? env('META_ACCESS_TOKEN');
        $this->apiVersion = config('services.meta.api_version') ?? env('META_CONVERSIONS_API_VERSION', 'v18.0');
    }

    /**
     * Send a conversion event to Meta Conversions API
     *
     * @param string $eventName The name of the conversion event (e.g., "qualified", "committed")
     * @param float $value The conversion value to send to Meta
     * @param Deal $deal The deal that triggered this event
     * @return bool Returns true if the event was sent successfully, false otherwise
     */
    public function sendEvent(string $eventName, float $value, Deal $deal): bool
    {
        // Validate configuration
        if (empty($this->pixelId) || empty($this->accessToken)) {
            Log::warning('Meta Conversions API credentials not configured', [
                'pixel_id_set' => !empty($this->pixelId),
                'access_token_set' => !empty($this->accessToken),
            ]);
            return false;
        }

        try {
            // Prepare the event payload
            $payload = $this->buildPayload($eventName, $value, $deal);

            // Construct API endpoint
            $endpoint = "https://graph.facebook.com/{$this->apiVersion}/{$this->pixelId}/events?access_token={$this->accessToken}";

            Log::info('Sending Meta Conversion Event', [
                'deal_id' => $deal->id,
                'event_name' => $eventName,
                'endpoint' => $endpoint,
                'payload' => $payload, // Full payload for debugging
            ]);

            
            $client = new Client([
                'timeout' => 30,
                'connect_timeout' => 15,
                'verify' => false,
            ]);

            $response = $client->post($endpoint, [
                'json' => $payload,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'User-Agent' => 'Hibarr-CRM/1.0',
                    'Accept' => 'application/json',
                ],
            ]);

            // // Send request to Meta Conversions API
            // $response = Http::timeout(30)
            //     ->post($endpoint, $payload);

            // Log response details
            $statusCode = $response->getStatusCode();
            $responseBody = $response->getBody()->getContents();

            Log::info('Meta Conversion Event Response', [
                'deal_id' => $deal->id,
                'event_name' => $eventName,
                'status_code' => $statusCode,
                'response' => $responseBody, // Full response for debugging
            ]);

            // Check if request was successful (2xx status code)
            if ($statusCode >= 200 && $statusCode < 300) {
                return true;
            }

            // Log error if not successful
            Log::error('Meta Conversion Event failed', [
                'deal_id' => $deal->id,
                'event_name' => $eventName,
                'status_code' => $statusCode,
                'error_response' => $responseBody,
            ]);

            return false;

        } catch (\Exception $e) {
            Log::error('Exception while sending Meta Conversion Event', [
                'deal_id' => $deal->id,
                'event_name' => $eventName,
                'exception_message' => $e->getMessage(),
                'exception_trace' => $e->getTraceAsString(),
            ]);

            return false;
        }
    }

    /**
     * Build the payload for Meta Conversions API
     *
     * @param string $eventName
     * @param Deal $deal
     * @return array
     */
    protected function buildPayload(string $eventName, float $value, Deal $deal): array
    {
        $contact = $deal->contact;
        
        // Prepare user data with hashed PII
        $userData = [];

        // Hash email if available
        if ($contact && !empty($contact->client_email)) {
            $userData['em'] = hash('sha256', strtolower(trim($contact->client_email)));
        }

        // Hash phone if available
        if ($contact && !empty($contact->mobile)) {
            // Remove non-numeric characters and hash
            $phone = preg_replace('/[^0-9]/', '', $contact->mobile);
            if (!empty($phone)) {
                $userData['ph'] = hash('sha256', $phone);
            }
        }

        // Add client name if available (hashed)
        if ($contact && !empty($contact->client_name)) {
            $nameParts = explode(' ', $contact->client_name, 2);
            $userData['fn'] = hash('sha256', strtolower(trim($nameParts[0])));
            if (isset($nameParts[1])) {
                $userData['ln'] = hash('sha256', strtolower(trim($nameParts[1])));
            }
        }

        // Prepare custom data
        $customData = [];
        $customData['value'] = (float) $value;
        
        // Currency is REQUIRED by Meta when value is present
        if ($deal->currency) {
            $customData['currency'] = $deal->currency->currency_code ?? 'GBP';
        } else {
            $customData['currency'] = 'GBP'; // Default currency
        }

        // Build the event data object
        $eventData = [
            'event_name' => $eventName,
            'event_time' => time(),
            'action_source' => 'system_generated',
            'user_data' => $userData,
            'custom_data' => $customData,
        ];

        // Add event_id for deduplication (optional but recommended)
        $eventData['event_id'] = 'deal_' . $deal->id . '_' . $eventName . '_' . time();

        // Wrap the event in a data array as required by Meta Conversions API
        return [
            'data' => [$eventData]
        ];
    }
}

