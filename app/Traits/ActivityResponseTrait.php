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
    public function sendActivityResponse(array $data, array $headers = [], int $maxRetries = 10, int $delay = 10000, int $timeout = 60): ?array
    {
        $url = config('app.automations.activities.activity_response_handler_url');
        
        if (empty($url)) {
            Log::warning('Activity response handler URL is not configured');
            return null;
        }

        $attempt = 0;
        
        $statusCode = null; // Initialize status code variable
        
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
                        Log::error('Internal Server Error - server error, stopping retries');
                        return [
                            'status_code' => $statusCode,
                            'response' => $responseData ?: $responseBody,
                            'success' => false
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
     * @param int $maxRetries
     * @param int $delay
     * @return array|null
     * @throws \InvalidArgumentException
     */
    public function sendActivity(array $activityData, array $headers = [], int $maxRetries = 5, int $delay = 10000, int $timeout = 60): ?array
    {
        // Basic validation
        if (empty($activityData['channel'])) {
            throw new \InvalidArgumentException("Activity data is missing required field 'channel'");
        }

        if (empty($activityData['message'])) {
            throw new \InvalidArgumentException("Activity data is missing required field 'message'");
        }

        return $this->sendActivityResponse($activityData, $headers, $maxRetries, $delay, $timeout);
    }
}
