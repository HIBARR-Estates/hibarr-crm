<?php

namespace Database\Factories\Email;

use App\Email\Enums\ConnectionStatus;
use App\Email\Models\EmailConnection;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmailConnection>
 */
class EmailConnectionFactory extends Factory
{
    protected $model = EmailConnection::class;

    public function definition(): array
    {
        $email = fake()->unique()->safeEmail();

        return [
            // No CompanyFactory exists, and Company is fully guarded.
            'company_id' => function () {
                $company = new Company;
                $company->company_name = fake()->company();
                $company->company_email = fake()->unique()->companyEmail();
                $company->company_phone = '0000000000';
                $company->address = 'Test address';
                $company->save();

                return $company->id;
            },
            'user_id' => fn (array $attributes) => User::factory()->create(['company_id' => $attributes['company_id']])->id,
            'provider' => 'fake',
            'identity_email' => $email,
            'from_email' => $email,
            'reply_to_email' => null,
            'credentials' => ['token' => 'fake-token'],
            'status' => ConnectionStatus::Active,
        ];
    }

    public function forUser(User $user): static
    {
        return $this->state(fn () => [
            'company_id' => $user->company_id,
            'user_id' => $user->id,
        ]);
    }

    public function stopped(): static
    {
        return $this->state(fn () => [
            'status' => ConnectionStatus::Stopped,
            'sync_stopped_at' => now(),
        ]);
    }

    public function needsReconnect(): static
    {
        return $this->state(fn () => [
            'status' => ConnectionStatus::NeedsReconnect,
            'last_error_code' => 'needs_reconnect',
        ]);
    }
}
