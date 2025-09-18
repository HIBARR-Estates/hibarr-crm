<?php

namespace App\Console\Commands;

use App\Traits\ActivityResponseTrait;
use Illuminate\Console\Command;

class TestActivityCommand extends Command
{
    use ActivityResponseTrait;

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'test:activity 
                            {channel : The channel to test (email, whatsapp, instagram, telegram)}
                            {message : The message to send}
                            {--email= : Email address for email channel}
                            {--phone= : Phone number for WhatsApp channel}
                            {--instagram= : Instagram username for Instagram channel}
                            {--telegram= : Telegram username for Telegram channel}
                            {--retries=3 : Number of retries}
                            {--delay=1000 : Delay between retries in milliseconds}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test the ActivityResponseTrait by sending a test message';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $channel = $this->argument('channel');
        $message = $this->argument('message');
        $retries = (int) $this->option('retries');
        $delay = (int) $this->option('delay');

        $this->info("Testing {$channel} channel with message: {$message}");
        $this->info("Retry settings: {$retries} retries, {$delay}ms delay");

        $options = $this->getOptionsForChannel($channel);

        if (empty($options)) {
            $this->error("Missing required options for {$channel} channel");
            return 1;
        }

        $this->info("Sending activity...");

        $response = $this->sendActivity($channel, $message, $options, [], $retries, $delay);

        if ($response !== null) {
            $this->info("✅ Activity sent successfully!");
            $this->line("Response: " . json_encode($response, JSON_PRETTY_PRINT));
            return 0;
        } else {
            $this->error("❌ Failed to send activity");
            return 1;
        }
    }

    /**
     * Get options for the specified channel
     *
     * @param string $channel
     * @return array
     */
    private function getOptionsForChannel(string $channel): array
    {
        switch ($channel) {
            case 'email':
                $email = $this->option('email') ?: $this->ask('Enter email address');
                return [
                    'email' => $email,
                    'subject' => 'Test Email from Hibarr CRM',
                    'first_name' => 'Test',
                    'last_name' => 'User'
                ];

            case 'whatsapp':
                $phone = $this->option('phone') ?: $this->ask('Enter phone number (e.g., +1234567890)');
                return [
                    'phone_number' => $phone,
                    'first_name' => 'Test',
                    'last_name' => 'User'
                ];

            case 'instagram':
                $username = $this->option('instagram') ?: $this->ask('Enter Instagram username (e.g., @username)');
                return [
                    'instagram_username' => $username,
                    'first_name' => 'Test',
                    'last_name' => 'User'
                ];

            case 'telegram':
                $username = $this->option('telegram') ?: $this->ask('Enter Telegram username (e.g., @username)');
                return [
                    'telegram_username' => $username,
                    'first_name' => 'Test',
                    'last_name' => 'User'
                ];

            default:
                return [];
        }
    }
}

