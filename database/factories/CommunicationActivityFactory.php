<?php

namespace Database\Factories;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\CommunicationActivity>
 */
class CommunicationActivityFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = CommunicationActivity::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $channels = ['email', 'whatsapp', 'instagram', 'telegram'];
        $channel = $this->faker->randomElement($channels);
        
        $senderNames = [
            'John Doe',
            'Jane Smith',
            'Mike Johnson',
            'Sarah Wilson',
            'David Brown',
            'Lisa Davis',
            'Robert Miller',
            'Emily Garcia'
        ];

        $senderContacts = [
            'john.doe@example.com',
            'jane.smith@example.com',
            '+1234567890',
            '+1987654321',
            'mike.johnson@example.com',
            'sarah.wilson@example.com',
            '+1555123456',
            'david.brown@example.com'
        ];

        $index = $this->faker->numberBetween(0, count($senderNames) - 1);

        return [
            'channel_type' => $channel,
            'message_content' => $this->faker->paragraph(3),
            'sender_info' => [
                'name' => $senderNames[$index],
                'contact' => $senderContacts[$index],
            ],
            'timestamp' => $this->faker->dateTimeBetween('-30 days', 'now'),
            'metadata' => [
                'platform' => $channel,
                'message_id' => $this->faker->uuid,
                'thread_id' => $this->faker->uuid,
            ],
            'company_id' => 1,
        ];
    }

    /**
     * Indicate that the communication activity is for a deal.
     */
    public function forDeal(Deal $deal): static
    {
        return $this->state(fn (array $attributes) => [
            'deal_id' => $deal->id,
            'lead_id' => null,
        ]);
    }

    /**
     * Indicate that the communication activity is for a lead.
     */
    public function forLead(Lead $lead): static
    {
        return $this->state(fn (array $attributes) => [
            'lead_id' => $lead->id,
            'deal_id' => null,
        ]);
    }

    /**
     * Indicate that the communication activity is via email.
     */
    public function email(): static
    {
        return $this->state(fn (array $attributes) => [
            'channel_type' => 'email',
        ]);
    }

    /**
     * Indicate that the communication activity is via WhatsApp.
     */
    public function whatsapp(): static
    {
        return $this->state(fn (array $attributes) => [
            'channel_type' => 'whatsapp',
        ]);
    }

    /**
     * Indicate that the communication activity is via Instagram.
     */
    public function instagram(): static
    {
        return $this->state(fn (array $attributes) => [
            'channel_type' => 'instagram',
        ]);
    }

    /**
     * Indicate that the communication activity is via Telegram.
     */
    public function telegram(): static
    {
        return $this->state(fn (array $attributes) => [
            'channel_type' => 'telegram',
        ]);
    }
} 