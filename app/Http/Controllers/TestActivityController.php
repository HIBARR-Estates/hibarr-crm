<?php

namespace App\Http\Controllers;

use App\Traits\ActivityResponseTrait;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class TestActivityController extends Controller
{
    use ActivityResponseTrait;

    /**
     * Test email activity
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function testEmail(Request $request): JsonResponse
    {
        $response = $this->sendActivity('email', 'Test email from Hibarr CRM', [
            'email' => $request->input('email', 'test@example.com'),
            'first_name' => $request->input('first_name', 'Test User'),
            'subject' => 'Test Email Subject',
            'message_type' => 'text'
        ]);

        return response()->json([
            'success' => $response !== null,
            'response' => $response,
            'message' => $response ? 'Email activity sent successfully' : 'Failed to send email activity'
        ]);
    }

    /**
     * Test WhatsApp activity
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function testWhatsApp(Request $request): JsonResponse
    {
        $response = $this->sendActivity('whatsapp', 'Test WhatsApp message from Hibarr CRM', [
            'phone_number' => $request->input('phone_number', '+1234567890'),
            'first_name' => $request->input('first_name', 'Test User'),
            'message_type' => 'text'
        ]);

        return response()->json([
            'success' => $response !== null,
            'response' => $response,
            'message' => $response ? 'WhatsApp activity sent successfully' : 'Failed to send WhatsApp activity'
        ]);
    }

    /**
     * Test Instagram activity
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function testInstagram(Request $request): JsonResponse
    {
        $response = $this->sendActivity('instagram', 'Test Instagram message from Hibarr CRM', [
            'instagram_username' => $request->input('instagram_username', '@test_user'),
            'message_type' => 'text'
        ]);

        return response()->json([
            'success' => $response !== null,
            'response' => $response,
            'message' => $response ? 'Instagram activity sent successfully' : 'Failed to send Instagram activity'
        ]);
    }

    /**
     * Test Telegram activity
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function testTelegram(Request $request): JsonResponse
    {
        $response = $this->sendActivity('telegram', 'Test Telegram message from Hibarr CRM', [
            'telegram_username' => $request->input('telegram_username', '@test_user'),
            'first_name' => $request->input('first_name', 'Test User'),
            'message_type' => 'text'
        ]);

        return response()->json([
            'success' => $response !== null,
            'response' => $response,
            'message' => $response ? 'Telegram activity sent successfully' : 'Failed to send Telegram activity'
        ]);
    }

    /**
     * Test with custom retry settings
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function testWithRetry(Request $request): JsonResponse
    {
        $channel = $request->input('channel', 'email');
        $message = $request->input('message', 'Test message with retry');
        $maxRetries = $request->input('max_retries', 3);
        $delay = $request->input('delay', 2000);

        $options = [];
        if ($channel === 'email') {
            $options['email'] = $request->input('email', 'test@example.com');
            $options['subject'] = 'Test with Retry';
        } elseif ($channel === 'whatsapp') {
            $options['phone_number'] = $request->input('phone_number', '+1234567890');
        }

        $response = $this->sendActivity($channel, $message, $options, [], $maxRetries, $delay);

        return response()->json([
            'success' => $response !== null,
            'response' => $response,
            'message' => $response ? 'Activity sent successfully with retry' : 'Failed to send activity after retries',
            'retry_settings' => [
                'max_retries' => $maxRetries,
                'delay' => $delay
            ]
        ]);
    }

    /**
     * Test all channels at once
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function testAllChannels(Request $request): JsonResponse
    {
        $results = [];

        // Test Email
        $results['email'] = $this->sendActivity('email', 'Test email from Hibarr CRM', [
            'email' => $request->input('email', 'test@example.com'),
            'subject' => 'Test All Channels'
        ]);

        // Test WhatsApp
        $results['whatsapp'] = $this->sendActivity('whatsapp', 'Test WhatsApp from Hibarr CRM', [
            'phone_number' => $request->input('phone_number', '+1234567890')
        ]);

        // Test Instagram
        $results['instagram'] = $this->sendActivity('instagram', 'Test Instagram from Hibarr CRM', [
            'instagram_username' => $request->input('instagram_username', '@test_user')
        ]);

        // Test Telegram
        $results['telegram'] = $this->sendActivity('telegram', 'Test Telegram from Hibarr CRM', [
            'telegram_username' => $request->input('telegram_username', '@test_user')
        ]);

        $successCount = count(array_filter($results, fn($result) => $result !== null));

        return response()->json([
            'success' => $successCount > 0,
            'results' => $results,
            'message' => "Successfully sent {$successCount} out of 4 activities"
        ]);
    }
}

