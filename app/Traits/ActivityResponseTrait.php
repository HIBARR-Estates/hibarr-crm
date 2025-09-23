<?php

namespace App\Traits;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\ActivityResponseRetryQueue;
use App\Jobs\ActivityResponseRetryJob;
use Exception;

trait ActivityResponseTrait
{
    /**
     * Make a POST request to the activity response handler URL with retry functionality
     *
     * @param array $data
     * @param array $headers
     * @param int $timeout
     * @return array|null
     */
    public function sendActivityResponse(array $data, array $headers = [], int $timeout = 60): ?array
    {
        $url = config('app.automations.activities.activity_response_handler_url');
        
        if (empty($url)) {
            Log::warning('Activity response handler URL is not configured');
            return null;
        }

        // Internal retry configuration variables
        $maxRetries = 10;
        $delay = 60 * 1000; // Convert to milliseconds
        
        // Handle null max_retries (disable retry queue)
        if ($maxRetries === null) {
            $maxRetries = 0; 
        }

        $attempt = 0;
        
        $statusCode = null; 
        
        while ($attempt < $maxRetries) {
            try {
                $defaultHeaders = [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'User-Agent' => 'Hibarr-CRM/1.0',
                ];

                $mergedHeaders = array_merge($defaultHeaders, $headers);

                $httpClient = Http::withHeaders($mergedHeaders)->timeout($timeout);
                
                // Disable SSL verification in development/local environment
                if (app()->environment(['local', 'development', 'testing', 'codecanyon'])) {
                    $httpClient = $httpClient->withOptions(['verify' => false]);
                }
                
                $response = $httpClient->post($url, $data);
                $statusCode = $response->status();

                $responseBody = $response->body();
                $responseData = null;
                
                // Try to parse JSON response
                try {
                    $responseData = json_decode($responseBody, true);
                } catch (Exception $e) {
                    Log::warning('Could not parse response as JSON', ['body' => $responseBody]);
                }

                // Check N8N response format first
                if ($responseData && isset($responseData['valid']) && isset($responseData['statusCode'])) {
                    $n8nValid = $responseData['valid'];
                    $n8nStatusCode = $responseData['statusCode'];
                    
                    if ($n8nValid && $n8nStatusCode === 200) {
                        Log::info('N8N response valid and successful', [
                            'url' => $url,
                            'http_status' => $statusCode,
                            'n8n_status' => $n8nStatusCode,
                            'attempt' => $attempt + 1
                        ]);
                        
                        return [
                            'status_code' => $statusCode,
                            'response' => $responseData,
                            'success' => true
                        ];
                    } elseif (!$n8nValid && ($n8nStatusCode === 400 || $n8nStatusCode === 422)) {
                        Log::error('N8N validation error - stopping retries', [
                            'url' => $url,
                            'http_status' => $statusCode,
                            'n8n_status' => $n8nStatusCode,
                            'missing_fields' => $responseData['missingFields'] ?? [],
                            'attempt' => $attempt + 1
                        ]);

                        if($n8nStatusCode === 400){
                            //Data sent to N8N is invalid
                        }
                        elseif($n8nStatusCode === 422){
                            //Data missing field in request
                        }
                        
                        return [
                            'status_code' => $n8nStatusCode,
                            'response' => $responseData,
                            'success' => false
                        ];
                    } elseif ($n8nValid && $n8nStatusCode === 500) {
                        // N8N internal error - should be retried
                        Log::error('N8N internal server error - will be retried', [
                            'url' => $url,
                            'http_status' => $statusCode,
                            'n8n_status' => $n8nStatusCode,
                            'error_message' => $responseData['errorMessage'] ?? null,
                            'attempt' => $attempt + 1
                        ]);
                        
                        // Continue to HTTP status code logic below for retry handling
                    }
                }
                
                // Fallback to HTTP status code logic
                if ($response->successful()) {
                    Log::info('HTTP response successful', [
                        'url' => $url,
                        'status' => $statusCode,
                        'attempt' => $attempt + 1
                    ]);

                    return [
                        'status_code' => $statusCode,
                        'response' => $responseData ?: $responseBody,
                        'success' => true
                    ];
                } else {
                    Log::error('Activity response failed', [
                        'url' => $url,
                        'status' => $statusCode,
                        'body' => $responseBody,
                        'attempt' => $attempt + 1
                    ]);

                    // Custom logic based on HTTP status codes
                    if ($statusCode === 404) {
                        Log::warning('Not Found - webhook not registered, will retry');
                        // Continue to retry logic below
                    } elseif ($statusCode === 500) {
                        Log::error('Internal Server Error - adding to retry queue', [
                            'url' => $url,
                            'status' => $statusCode,
                            'body' => $responseBody,
                            'attempt' => $attempt + 1
                        ]);
                        
                        // Add to retry queue if enabled and max retries is not null
                        if (true && 10 !== null) {
                            $this->addToRetryQueue($data, $headers, $timeout, [
                                'status_code' => $statusCode,
                                'response' => $responseData ?: $responseBody,
                                'success' => false
                            ]);
                        }
                        
                        return [
                            'status_code' => $statusCode,
                            'response' => $responseData ?: $responseBody,
                            'success' => false,
                            'queued_for_retry' => true
                        ];
                    } else {
                        Log::error("Unexpected status code {$statusCode}, stopping retries");
                        return [
                            'status_code' => $statusCode,
                            'response' => $responseData ?: $responseBody,
                            'success' => false
                        ];
                    }
                }

            } catch (Exception $e) {
                Log::error('Activity response exception', [
                    'url' => $url,
                    'error' => $e->getMessage(),
                    'attempt' => $attempt + 1
                ]);
                $statusCode = 0; // Set to 0 for exceptions
            }
            
            $attempt++;
            
            // Only retry if we got a 404 error and haven't exceeded max retries
            if ($statusCode === 404 && $attempt < $maxRetries) {
                Log::info("Retrying activity response for 404 error, attempt {$attempt}");
                usleep($delay * 1000); // Convert to microseconds
                $delay *= 2; // Exponential backoff
            } else {
                // Stop retrying for non-404 errors or when max retries reached
                break;
            }
        }
        
        Log::error("Activity response failed after {$maxRetries} attempts");
        
        // Check if N8N is unreachable and add notification
        $this->handleMaxRetriesReached($data, $statusCode, $attempt);
        
        return [
            'status_code' => 404,
            'response' => 'Max retries exceeded',
            'success' => false
        ];
    }

    /**
     * Send activity data to N8N with basic validation
     *
     * @param array $activityData
     * @param array $headers
     * @param int $timeout
     * @return array|null
     * @throws \InvalidArgumentException
     */
    public function sendActivity(array $activityData, array $headers = [], int $timeout = 60): ?array
    {
        // Basic validation
        if (empty($activityData['channel'])) {
            throw new \InvalidArgumentException("Activity data is missing required field 'channel'");
        }

        if (empty($activityData['message'])) {
            throw new \InvalidArgumentException("Activity data is missing required field 'message'");
        }

        // Channel-specific validation
        $this->validateChannelData($activityData);

        return $this->sendActivityResponse($activityData, $headers, $timeout);
    }

    /**
     * Validate channel-specific data
     *
     * @param array $data
     * @throws \InvalidArgumentException
     */
    protected function validateChannelData(array $data): void
    {
        $channel = $data['channel'];
        
        switch ($channel) {
            case 'email':
                $this->validateEmailChannel($data);
                break;
            case 'whatsapp':
                $this->validateWhatsAppChannel($data);
                break;
            case 'instagram':
                $this->validateInstagramChannel($data);
                break;
            case 'telegram':
                $this->validateTelegramChannel($data);
                break;
            default:
                Log::warning("Unknown channel type: {$channel}, skipping channel-specific validation");
                break;
        }
    }

    /**
     * Validate email channel data
     */
    protected function validateEmailChannel(array $data): void
    {
        $requiredFields = ['email', 'subject', 'first_name', 'last_name', 'reply_to', 'message_type', 'sender_name'];
        
        $this->validateRequiredFields($data, $requiredFields, 'email');
        
        // Email format validation
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException("Invalid email format for email channel: {$data['email']}");
        }
        
        // Reply-to email validation
        if (!filter_var($data['reply_to'], FILTER_VALIDATE_EMAIL)) {
            throw new \InvalidArgumentException("Invalid reply-to email format: {$data['reply_to']}");
        }
    }

    /**
     * Validate WhatsApp channel data
     */
    protected function validateWhatsAppChannel(array $data): void
    {
        $requiredFields = ['phone_number', 'first_name', 'last_name'];
        
        $this->validateRequiredFields($data, $requiredFields, 'whatsapp');
        
        // Phone number format validation (basic)
        $phone = preg_replace('/[^0-9+]/', '', $data['phone_number']);
        if (strlen($phone) < 10) {
            throw new \InvalidArgumentException("Invalid phone number format for WhatsApp channel: {$data['phone_number']}");
        }
    }

    /**
     * Validate Instagram channel data
     */
    protected function validateInstagramChannel(array $data): void
    {
        $requiredFields = ['instagram_username', 'instagram_page_id', 'first_name', 'last_name'];
        
        $this->validateRequiredFields($data, $requiredFields, 'instagram');
        
        // Instagram username validation
        $username = $data['instagram_username'];
        if (!preg_match('/^@?[a-zA-Z0-9._]{1,30}$/', $username)) {
            throw new \InvalidArgumentException("Invalid Instagram username format: {$username}");
        }
        
        // Instagram page ID validation (should be numeric)
        $pageId = $data['instagram_page_id'];
        if (!preg_match('/^\d+$/', $pageId)) {
            throw new \InvalidArgumentException("Invalid Instagram page ID format: {$pageId}");
        }
    }

    /**
     * Validate Telegram channel data
     */
    protected function validateTelegramChannel(array $data): void
    {
        $requiredFields = ['telegram_username', 'telegram_chat_id', 'first_name', 'last_name'];
        
        $this->validateRequiredFields($data, $requiredFields, 'telegram');
        
        // Telegram username validation
        $username = $data['telegram_username'];
        if (!preg_match('/^@?[a-zA-Z0-9_]{5,32}$/', $username)) {
            throw new \InvalidArgumentException("Invalid Telegram username format: {$username}");
        }
        
        // Telegram chat ID validation
        $chatId = $data['telegram_chat_id'];
        if (!preg_match('/^-?\d+$/', $chatId)) {
            throw new \InvalidArgumentException("Invalid Telegram chat ID format: {$chatId}");
        }
    }


    /**
     * Validate required fields for a channel
     */
    protected function validateRequiredFields(array $data, array $requiredFields, string $channel): void
    {
        foreach ($requiredFields as $field) {
            if (empty($data[$field])) {
                throw new \InvalidArgumentException("{$channel} channel is missing required field '{$field}'");
            }
        }
    }


    /**
     * Handle when max retries are reached in immediate retry logic
     */
    protected function handleMaxRetriesReached(array $data, int $statusCode, int $attempts): void
    {
        $isN8NUnreachable = $this->isN8NUnreachable($statusCode, 'Max retries exceeded');
        
        if ($isN8NUnreachable) {
            $this->addN8NUnreachableNotification($data, $statusCode, $attempts);
        }
    }

    /**
     * Check if N8N is unreachable based on status code and response
     */
    protected function isN8NUnreachable(int $statusCode, string $response = ''): bool
    {
        // Check for common unreachable scenarios
        $unreachableStatusCodes = [0, 404, 500, 502, 503, 504];
        $unreachableMessages = [
            'webhook not registered',
            'connection refused',
            'timeout',
            'unreachable',
            'not found',
            'internal server error',
            'max retries exceeded'
        ];

        // Check status code
        if (in_array($statusCode, $unreachableStatusCodes)) {
            return true;
        }

        // Check response message for unreachable indicators
        foreach ($unreachableMessages as $message) {
            if (stripos($response, $message) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Add notification to queue when N8N is unreachable
     */
    protected function addN8NUnreachableNotification(array $data, int $statusCode, int $attempts): void
    {
        try {
            $channel = $data['channel'] ?? 'unknown';
            
            // Create notification data
            $notificationData = [
                'channel' => 'system_notification',
                'message' => "N8N webhook unreachable after {$attempts} immediate retry attempts. Activity response failed for {$channel} channel.",
                'title' => 'N8N Webhook Unreachable (Immediate Retry)',
                'priority' => 'high',
                'original_channel' => $channel,
                'original_data' => $data,
                'status_code' => $statusCode,
                'failed_at' => now()->toISOString(),
                'attempts' => $attempts,
                'retry_type' => 'immediate'
            ];

            // Add to retry queue as a notification
            ActivityResponseRetryQueue::create([
                'original_data' => $notificationData,
                'original_headers' => [],
                'channel' => 'system_notification',
                'status' => 'pending',
                'attempts' => 0,
                'next_retry_at' => now()->addMinutes(5), // Retry notification after 5 minutes
                'last_response' => null
            ]);

            Log::error('N8N unreachable notification added to queue (immediate retry)', [
                'channel' => $channel,
                'attempts' => $attempts,
                'status_code' => $statusCode,
                'notification_data' => $notificationData
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to add N8N unreachable notification (immediate retry)', [
                'channel' => $data['channel'] ?? 'unknown',
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Add failed request to retry queue
     *
     * @param array $data
     * @param array $headers
     * @param int $timeout
     * @param array $response
     * @return int|null Retry queue ID
     */
    protected function addToRetryQueue(array $data, array $headers, int $timeout, array $response): ?int
    {
        try {
            $retryQueue = ActivityResponseRetryQueue::create([
                'original_data' => $data,
                'original_headers' => $headers,
                'channel' => $data['channel'] ?? null,
                'status' => ActivityResponseRetryQueue::STATUS_PENDING,
                'attempts' => 0,
                'last_response' => $response,
                'next_retry_at' => now()->addSeconds(120)
            ]);

            Log::info('Added request to retry queue', [
                'retry_queue_id' => $retryQueue->id,
                'channel' => $data['channel'] ?? 'unknown',
                'next_retry_at' => $retryQueue->next_retry_at
            ]);

            // Dispatch the retry job
            ActivityResponseRetryJob::dispatch(
                $retryQueue->id,
                $data,
                $headers,
                $timeout
            )->delay($retryQueue->next_retry_at);

            return $retryQueue->id;

        } catch (\Exception $e) {
            Log::error('Failed to add request to retry queue', [
                'error' => $e->getMessage(),
                'data' => $data
            ]);
            return null;
        }
    }
}
