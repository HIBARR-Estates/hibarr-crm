<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel application
$app = require __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Traits\ActivityResponseTrait;

if (!class_exists('TestActivity')) {
class TestActivity
{
    use ActivityResponseTrait {
        sendActivityResponse as protected originalSendActivityResponse;
    }

    // Override to use real N8N webhook
    public function sendActivityResponse(array $data, array $headers = [], int $maxRetries = 10, int $delay = 10000, int $timeout = 60): ?array
    {
        // Use real N8N webhook URL
        $url = 'https://automations.hibarr.net/webhook-test/activity-response-handler';
        
        echo "📤 Sending to: {$url}\n";
        echo "📦 Data: " . json_encode($data, JSON_PRETTY_PRINT) . "\n";
        
        // Let the trait handle all retry logic
        $response = $this->originalSendActivityResponse($data, $headers, $maxRetries, $delay, $timeout);
        
        // Display status code and response details
        if ($response && isset($response['status_code'])) {
            $statusCode = $response['status_code'];
            $success = $response['success'] ?? false;
            $responseData = $response['response'] ?? null;
            
            if ($success) {
                echo "✅ Status: {$statusCode} (Success)\n";
            } else {
                echo "❌ Status: {$statusCode} (Failed)\n";
            }
            echo "📋 Response: " . json_encode($responseData, JSON_PRETTY_PRINT) . "\n";
        } else {
            echo "❌ Status: Unknown (No response returned)\n";
            echo "📋 Response: null\n";
        }
        
        return $response;
    }

    public function runTests($specificChannel = null)
    {
        echo "🧪 Testing ActivityResponseTrait\n";
        echo "================================\n";
        if ($specificChannel) {
            echo "🎯 Testing specific channel: {$specificChannel}\n";
        }
        echo "\n";

        // Test 1: Email
        if (!$specificChannel || $specificChannel === 'email') {
        echo "📧 Testing Email Channel...\n";
            $emailData = [
                'channel' => 'email',
                'message' => 'Test email from Hibarr CRM',
            'email' => 'test@example.com',
                'subject' => 'Test Email Subject',
            'first_name' => 'Test',
            'last_name' => 'User',
                'reply_to' => 'test@example.com',
                'message_type' => 'text',
                // 'sender_name' => 'CRM User'
            ];
            echo "⏳ Waiting for N8N response (up to 2 minutes)...\n";
            $response = $this->sendActivity($emailData, [], 3, 5000, 120);
            $success = $response && isset($response['success']) && $response['success'];
        }

        // Test 2: WhatsApp
        if (!$specificChannel || $specificChannel === 'whatsapp') {
        echo "📱 Testing WhatsApp Channel...\n";
            $whatsappData = [
                'channel' => 'whatsapp',
                 'message' => 'Test WhatsApp message from Hibarr CRM',
            'phone_number' => '+1234567890',
            'first_name' => 'Test',
                'last_name' => 'User'
            ];
            echo "⏳ Waiting for N8N response (up to 2 minutes)...\n";
            $response = $this->sendActivity($whatsappData, [], 3, 5000, 120);
            $success = $response && isset($response['success']) && $response['success'];
        }

        // Test 3: Instagram
        if (!$specificChannel || $specificChannel === 'instagram') {
        echo "📸 Testing Instagram Channel...\n";
            $instagramData = [
                'channel' => 'instagram',
                'message' => 'Test Instagram message from Hibarr CRM',
            'instagram_username' => '@test_user',
                'first_name' => 'Test',
                'last_name' => 'User'
            ];
            echo "⏳ Waiting for N8N response (up to 2 minutes)...\n";
            $response = $this->sendActivity($instagramData, [], 3, 5000, 120);
            $success = $response && isset($response['success']) && $response['success'];
        }

        // Test 4: Telegram
        if (!$specificChannel || $specificChannel === 'telegram') {
        echo "💬 Testing Telegram Channel...\n";
            $telegramData = [
                'channel' => 'telegram',
                'message' => 'Test Telegram message from Hibarr CRM',
            'telegram_username' => '@test_user',
                'telegram_chat_id' => '123456789',
            'first_name' => 'Test',
                'last_name' => 'User'
            ];
            echo "⏳ Waiting for N8N response (up to 2 minutes)...\n";
            $response = $this->sendActivity($telegramData, [], 3, 5000, 120);
            $success = $response && isset($response['success']) && $response['success'];
        }


        // Test 5: Validation Test - Missing channel (always run)
        echo "⚠️  Testing Validation - Missing Channel...\n";
        try {
            $invalidData = [
                'message' => 'This should fail'
            ];
            $this->sendActivity($invalidData);
            echo "❌ Validation failed - should have thrown exception\n";
        } catch (\InvalidArgumentException $e) {
            echo "✅ Validation working correctly: " . $e->getMessage() . "\n";
        }
        echo "\n";

        // Test 6: Validation Test - Missing message (always run)
        echo "⚠️  Testing Validation - Missing Message...\n";
        try {
            $invalidData = [
                'channel' => 'email'
            ];
            $this->sendActivity($invalidData);
            echo "❌ Validation failed - should have thrown exception\n";
        } catch (\InvalidArgumentException $e) {
            echo "✅ Validation working correctly: " . $e->getMessage() . "\n";
        }
        echo "\n";

        echo "🏁 Testing completed!\n";
    }
}
}

// Get command line argument for specific channel
$specificChannel = null;
if (isset($_SERVER['argv'][1])) {
    $specificChannel = $_SERVER['argv'][1];
}

// Validate channel if specified
$validChannels = ['email', 'whatsapp', 'instagram', 'telegram'];
if ($specificChannel && !in_array($specificChannel, $validChannels)) {
    echo "❌ Invalid channel: {$specificChannel}\n";
    echo "Valid channels: " . implode(', ', $validChannels) . "\n";
    exit(1);
}

// Run the tests
echo "🚀 Starting test execution...\n";
$test = new TestActivity();
$test->runTests($specificChannel);
echo "🏁 Test execution completed!\n";


