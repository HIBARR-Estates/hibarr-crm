<?php

namespace App\Examples;

use App\Traits\ActivityResponseTrait;

class ActivityUsageExample
{
    use ActivityResponseTrait;

    /**
     * Example usage of the updated ActivityResponseTrait
     */
    public function examples()
    {
        // Example 1: Send email activity
        $response = $this->sendActivity('email', 'Hello from Hibarr CRM!', [
            'email' => 'user@example.com',
            'first_name' => 'John',
            'last_name' => 'Doe',
            'subject' => 'Welcome to Hibarr CRM',
            'message_type' => 'text'
        ]);

        // Example 2: Send WhatsApp activity
        $response = $this->sendActivity('whatsapp', 'Your deal has been updated!', [
            'phone_number' => '+1234567890',
            'first_name' => 'Jane',
            'message_type' => 'text'
        ]);

        // Example 3: Send Instagram activity
        $response = $this->sendActivity('instagram', 'Check out our latest update!', [
            'instagram_username' => '@hibarr_crm',
            'message_type' => 'image',
            'files' => ['image1.jpg', 'image2.jpg']
        ]);

        // Example 4: Send Telegram activity
        $response = $this->sendActivity('telegram', 'New notification from Hibarr CRM', [
            'telegram_username' => '@hibarr_user',
            'first_name' => 'Bob',
            'message_type' => 'text'
        ]);

        // Example 5: Send with custom retry settings
        $response = $this->sendActivity('email', 'Important notification', [
            'email' => 'admin@example.com',
            'subject' => 'System Alert'
        ], [], 5, 3000); // 5 retries, 3 second delay


        return $response;
    }

    /**
     * Example for different message types
     */
    public function sendDifferentMessageTypes()
    {
        // Text message
        $this->sendActivity('whatsapp', 'Simple text message', [
            'phone_number' => '+1234567890',
            'message_type' => 'text'
        ]);

        // Image message
        $this->sendActivity('instagram', 'Check this out!', [
            'instagram_username' => '@user',
            'message_type' => 'image',
            'files' => ['photo.jpg']
        ]);

        // Video message
        $this->sendActivity('telegram', 'Watch this video', [
            'telegram_username' => '@user',
            'message_type' => 'video',
            'files' => ['video.mp4']
        ]);

        // Audio message
        $this->sendActivity('whatsapp', 'Voice message', [
            'phone_number' => '+1234567890',
            'message_type' => 'audio',
            'files' => ['audio.mp3']
        ]);

        // File attachment
        $this->sendActivity('email', 'Please find the attached document', [
            'email' => 'user@example.com',
            'subject' => 'Document Attached',
            'message_type' => 'file',
            'files' => ['document.pdf', 'spreadsheet.xlsx']
        ]);
    }
}
