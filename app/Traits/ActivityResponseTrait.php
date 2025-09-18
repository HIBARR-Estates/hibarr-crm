<?php

namespace App\Traits;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

trait ActivityResponseTrait
{
    /**
     * Make a POST request to the activity response handler URL with retry functionality
     *
     * @param array $data
     * @param array $headers
     * @param int $maxRetries
     * @param int $delay
     * @return array|null
     */
    public function sendActivityResponse(array $data, array $headers = [], int $maxRetries = 10, int $delay = 10000): ?array
    {
        $url = config('app.automations.activities.activity_response_handler_url');
        
        if (empty($url)) {
            Log::warning('Activity response handler URL is not configured');
            return null;
        }

        $attempt = 0;
        
        while ($attempt < $maxRetries) {
            try {
                $defaultHeaders = [
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                    'User-Agent' => 'Hibarr-CRM/1.0',
                ];

                $mergedHeaders = array_merge($defaultHeaders, $headers);

                $httpClient = Http::withHeaders($mergedHeaders)->timeout(30);
                
                // Disable SSL verification in development/local environment
                if (app()->environment(['local', 'development', 'testing', 'codecanyon'])) {
                    $httpClient = $httpClient->withOptions(['verify' => false]);
                }
                
                $response = $httpClient->post($url, $data);

                if ($response->successful()) {
                    Log::info('Activity response sent successfully', [
                        'url' => $url,
                        'status' => $response->status(),
                        'attempt' => $attempt + 1
                    ]);

                    return $response->json();
                } else {
                    Log::error('Activity response failed', [
                        'url' => $url,
                        'status' => $response->status(),
                        'body' => $response->body(),
                        'attempt' => $attempt + 1
                    ]);
                }

            } catch (Exception $e) {
                Log::error('Activity response exception', [
                    'url' => $url,
                    'error' => $e->getMessage(),
                    'attempt' => $attempt + 1
                ]);
            }
            
            $attempt++;
            
            if ($attempt < $maxRetries) {
                Log::info("Retrying activity response, attempt {$attempt}");
                usleep($delay * 1000); // Convert to microseconds
                $delay *= 2; // Exponential backoff
            }
        }
        
        Log::error("Activity response failed after {$maxRetries} attempts");
        return null;
    }



    /**
     * Prepare activity data for sending based on ActivityDTO format
     *
     * @param string $channel - 'email' | 'whatsapp' | 'instagram' | 'telegram'
     * @param string $message
     * @param array $options - Additional options like email, phone_number, etc.
     * @return array
     */
    public function prepareActivityData(string $channel, string $message, array $options = []): array
    {
        $data = [
            'channel' => $channel,
            'message' => $message,
        ];

        // Add optional fields based on channel
        if (isset($options['email'])) {
            $data['email'] = $options['email'];
        }

        if (isset($options['phone_number'])) {
            $data['phone_number'] = $options['phone_number'];
        }

        if (isset($options['instagram_username'])) {
            $data['instagram_username'] = $options['instagram_username'];
        }

        if (isset($options['telegram_username'])) {
            $data['telegram_username'] = $options['telegram_username'];
        }

        if (isset($options['first_name'])) {
            $data['first_name'] = $options['first_name'];
        }

        if (isset($options['last_name'])) {
            $data['last_name'] = $options['last_name'];
        }

        if (isset($options['message_type'])) {
            $data['message_type'] = $options['message_type'];
        }

        if (isset($options['subject'])) {
            $data['subject'] = $options['subject'];
        }

        if (isset($options['files'])) {
            $data['files'] = $options['files'];
        }

        return $data;
    }

    /**
     * Send activity response with ActivityDTO format
     *
     * @param string $channel
     * @param string $message
     * @param array $options
     * @param array $headers
     * @param int $maxRetries
     * @param int $delay
     * @return array|null
     */
    public function sendActivity(string $channel, string $message, array $options = [], array $headers = [], int $maxRetries = 5, int $delay = 10000): ?array
    {
        $data = $this->prepareActivityData($channel, $message, $options);
        return $this->sendActivityResponse($data, $headers, $maxRetries, $delay);
    }
}
