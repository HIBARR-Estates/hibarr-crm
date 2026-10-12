<?php

namespace Database\Factories\Email;

use App\Email\Models\EmailPilotAllowlistEntry;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Has no default company: build it with forUser() or forCompany().
 *
 * @extends Factory<EmailPilotAllowlistEntry>
 */
class EmailPilotAllowlistEntryFactory extends Factory
{
    protected $model = EmailPilotAllowlistEntry::class;

    public function definition(): array
    {
        return [
            'user_id' => null,
            'added_by' => null,
        ];
    }

    public function forUser(User $user): static
    {
        return $this->state(fn () => [
            'company_id' => $user->company_id,
            'user_id' => $user->id,
        ]);
    }

    public function forCompany(int $companyId): static
    {
        return $this->state(fn () => [
            'company_id' => $companyId,
            'user_id' => null,
        ]);
    }
}
