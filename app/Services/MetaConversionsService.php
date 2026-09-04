<?php

namespace App\Services;

use App\Models\Deal;
use App\Models\Lead;
use GuzzleHttp\Client;
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
     * @param  string  $eventName  The name of the conversion event (e.g., "qualified", "committed")
     * @param  float  $value  The conversion value to send to Meta
     * @param  Deal|Lead  $subject  The deal or lead that triggered this event — a
     *                              lead-subject automation has no deal at all, so this accepts either.
     * @return bool Returns true if the event was sent successfully, false otherwise
     */
    public function sendEvent(string $eventName, float $value, Deal|Lead $subject): bool
    {
        return $this->send($eventName, $value, $subject)['success'];
    }

    /**
     * Same send as sendEvent(), but returning everything Meta said about it so
     * the caller can persist a diagnosable log entry instead of just a boolean.
     *
     * Never throws: a transport failure comes back as ['success' => false] with
     * the exception message in 'error'.
     *
     * @return array{
     *     success: bool,
     *     event_name: string,
     *     event_id: string|null,
     *     value: float,
     *     pixel_id: string|null,
     *     api_version: string,
     *     status_code: int|null,
     *     events_received: int|null,
     *     fbtrace_id: string|null,
     *     error: string|null,
     *     error_details: array<string, mixed>|null,
     *     response_body: string|null
     * }
     */
    public function send(string $eventName, float $value, Deal|Lead $subject): array
    {
        $result = [
            'success' => false,
            'event_name' => $eventName,
            'event_id' => null,
            'value' => $value,
            'pixel_id' => $this->pixelId,
            'api_version' => $this->apiVersion,
            'status_code' => null,
            'events_received' => null,
            'fbtrace_id' => null,
            'error' => null,
            'error_details' => null,
            'response_body' => null,
        ];

        // Validate configuration
        if (empty($this->pixelId) || empty($this->accessToken)) {
            Log::warning('Meta Conversions API credentials not configured', [
                'pixel_id_set' => ! empty($this->pixelId),
                'access_token_set' => ! empty($this->accessToken),
            ]);

            $result['error'] = 'Meta Conversions API credentials are not configured'
                .' (pixel id '.(empty($this->pixelId) ? 'missing' : 'set')
                .', access token '.(empty($this->accessToken) ? 'missing' : 'set').').';

            return $result;
        }

        $logContext = $subject instanceof Lead ? ['lead_id' => $subject->id] : ['deal_id' => $subject->id];

        try {
            // Prepare the event payload
            $payload = $this->buildPayload($eventName, $value, $subject);
            $result['event_id'] = $payload['data'][0]['event_id'] ?? null;

            // Construct API endpoint
            $endpoint = "https://graph.facebook.com/{$this->apiVersion}/{$this->pixelId}/events?access_token={$this->accessToken}";

            Log::info('Sending Meta Conversion Event', $logContext + [
                'event_name' => $eventName,
                'endpoint' => $endpoint,
                'payload' => $payload, // Full payload for debugging
            ]);

            $client = new Client([
                'timeout' => 30,
                'connect_timeout' => 15,
                // Meta explains *why* it rejected an event in the body of a 4xx
                // response. Guzzle's default would throw that body away as a
                // RequestException, which is the whole reason failures used to
                // be undiagnosable — read the response instead.
                'http_errors' => false,
            ]);

            $response = $client->post($endpoint, [
                'json' => $payload,
                'headers' => [
                    'Content-Type' => 'application/json',
                    'User-Agent' => 'Hibarr-CRM/1.0',
                    'Accept' => 'application/json',
                ],
            ]);

            // Log response details
            $statusCode = $response->getStatusCode();
            $responseBody = $response->getBody()->getContents();
            $decoded = json_decode($responseBody, true);
            $decoded = is_array($decoded) ? $decoded : [];

            $result['status_code'] = $statusCode;
            $result['response_body'] = $this->truncate($responseBody);
            $result['events_received'] = isset($decoded['events_received']) ? (int) $decoded['events_received'] : null;
            $result['fbtrace_id'] = $decoded['fbtrace_id'] ?? ($decoded['error']['fbtrace_id'] ?? null);

            Log::info('Meta Conversion Event Response', $logContext + [
                'event_name' => $eventName,
                'status_code' => $statusCode,
                'response' => $responseBody, // Full response for debugging
            ]);

            // Check if request was successful (2xx status code)
            if ($statusCode >= 200 && $statusCode < 300) {
                $result['success'] = true;

                return $result;
            }

            // Meta's error object: message / type / code / error_subcode /
            // error_user_title / error_user_msg — the actionable part.
            $error = is_array($decoded['error'] ?? null) ? $decoded['error'] : null;
            $result['error_details'] = $error;
            $result['error'] = $error['error_user_msg']
                ?? $error['message']
                ?? "Meta rejected the event with HTTP {$statusCode}.";

            // Log error if not successful
            Log::error('Meta Conversion Event failed', $logContext + [
                'event_name' => $eventName,
                'status_code' => $statusCode,
                'error_response' => $responseBody,
            ]);

            return $result;

        } catch (\Throwable $e) {
            Log::error('Exception while sending Meta Conversion Event', $logContext + [
                'event_name' => $eventName,
                'exception_message' => $e->getMessage(),
                'exception_trace' => $e->getTraceAsString(),
            ]);

            $result['error'] = $e->getMessage();

            return $result;
        }
    }

    /** Keep an oversized Meta response from bloating the log row. */
    protected function truncate(?string $value, int $limit = 4000): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return mb_strlen($value) > $limit ? mb_substr($value, 0, $limit).'…' : $value;
    }

    /**
     * Build the payload for Meta Conversions API
     */
    protected function buildPayload(string $eventName, float $value, Deal|Lead $subject): array
    {
        $contact = $subject instanceof Lead ? $subject : $subject->contact;
        $leadMarketing = $contact->leadMarketing;

        // Prepare user data with hashed PII
        $userData = [];

        // Add External ID
        $userData['external_id'] = $contact->id;

        // Hash email if available
        if ($contact && ! empty($contact->client_email)) {
            $userData['em'] = hash('sha256', strtolower(trim($contact->client_email)));
        }

        // Hash phone if available
        if ($contact && ! empty($contact->mobile)) {
            // Remove non-numeric characters and hash
            $phone = preg_replace('/[^0-9]/', '', $contact->mobile);
            if (! empty($phone)) {
                $userData['ph'] = hash('sha256', $phone);
            }
        }
        // Meta expects ge = SHA-256 of a single lowercase letter: m or f.
        if ($contact && ! empty($contact->gender)) {
            $gender = strtolower(trim((string) ($contact->gender?->value ?? $contact->gender)));
            $metaGender = match ($gender) {
                'male' => 'm',
                'female' => 'f',
                default => null,
            };

            if ($metaGender !== null) {
                $userData['ge'] = hash('sha256', $metaGender);
            }
        }

        // Add Date of Birth if available
        if ($contact && ! empty($contact->date_of_birth)) {
            $userData['db'] = hash('sha256', $contact->date_of_birth);
        }
        // Add Country if available (Meta expects 2-letter ISO, hashed)
        if ($contact && ! empty($contact->country_iso)) {
            $userData['country'] = hash('sha256', strtolower($contact->country_iso));
        }
        // Add Zip Code if available
        if ($contact && ! empty($contact->postal_code)) {
            $userData['zp'] = hash('sha256', $contact->postal_code);
        }
        // Add city if available
        if ($contact && ! empty($contact->city)) {
            $userData['ct'] = hash('sha256', $contact->city);
        }
        // Add state if available
        if ($contact && ! empty($contact->state)) {
            $userData['st'] = hash('sha256', $contact->state);
        }

        // Add Facebook browser ID if available
        if ($leadMarketing && ! empty($leadMarketing->facebook_browser_id)) {
            $userData['fbp'] = $leadMarketing->facebook_browser_id;
        }

        // Add Facebook ClickID if available
        if ($leadMarketing && ! empty($leadMarketing->facebook_click_id)) {
            $userData['fbc'] = $leadMarketing->facebook_click_id;
        }

        // Add Facebook LeadID if available
        if ($leadMarketing && ! empty($leadMarketing->facebook_lead_id)) {
            $userData['lead_id'] = $leadMarketing->facebook_lead_id;
        }

        // Add user agent if available
        if ($leadMarketing && ! empty($leadMarketing->user_agent)) {
            $userData['client_user_agent'] = $leadMarketing->user_agent;
        }

        // Add IP address if available
        if ($leadMarketing && ! empty($leadMarketing->ip_address)) {
            $userData['client_ip_address'] = $leadMarketing->ip_address;
        }

        // Add client name if available (hashed)
        if ($contact && ! empty($contact->client_name)) {
            $nameParts = explode(' ', $contact->client_name, 2);
            $userData['fn'] = hash('sha256', strtolower(trim($nameParts[0])));
            if (isset($nameParts[1])) {
                $userData['ln'] = hash('sha256', strtolower(trim($nameParts[1])));
            }
        }

        // Prepare custom data
        $customData = [];
        $customData['value'] = (float) $value;

        // Currency is REQUIRED by Meta when value is present. A Lead has no
        // currency of its own (it isn't tied to one deal) — fall back to the
        // same default a currency-less Deal already used.
        if ($subject instanceof Deal && $subject->currency) {
            $customData['currency'] = $subject->currency->currency_code ?? 'GBP';
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
        $subjectLabel = $subject instanceof Lead ? 'lead_'.$subject->id : 'deal_'.$subject->id;
        $eventData['event_id'] = $subjectLabel.'_'.$eventName.'_'.time();

        // Wrap the event in a data array as required by Meta Conversions API
        return [
            'data' => [$eventData],
        ];
    }
}
