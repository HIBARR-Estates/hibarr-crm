<?php

namespace App\Traits;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

trait ActivityResponseTrait
{
    /**
     * Make a POST request to the activity response handler URL
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
                        'n8n_status' => $n8nStatusCode
                    ]);
                    
                    return [
                        'status_code' => $statusCode,
                        'response' => $responseData,
                        'success' => true
                    ];
                } elseif (!$n8nValid && ($n8nStatusCode === 400 || $n8nStatusCode === 422)) {
                    Log::error('N8N validation error', [
                        'url' => $url,
                        'http_status' => $statusCode,
                        'n8n_status' => $n8nStatusCode,
                        'missing_fields' => $responseData['missingFields'] ?? []
                    ]);
                    
                    return [
                        'status_code' => $n8nStatusCode,
                        'response' => $responseData,
                        'success' => false
                    ];
                }
            }
            
            // Fallback to HTTP status code logic
            if ($response->successful()) {
                Log::info('HTTP response successful', [
                    'url' => $url,
                    'status' => $statusCode
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
                    'body' => $responseBody
                ]);

                return [
                    'status_code' => $statusCode,
                    'response' => $responseData ?: $responseBody,
                    'success' => false
                ];
            }

        } catch (Exception $e) {
            Log::error('Activity response exception', [
                'url' => $url,
                'error' => $e->getMessage()
            ]);
            
            return [
                'status_code' => 0,
                'response' => $e->getMessage(),
                'success' => false
            ];
        }
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
}