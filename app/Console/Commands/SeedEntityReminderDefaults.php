<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\EntityReminderDefault;
use App\Models\ReminderEmailTemplate;
use Illuminate\Console\Command;

class SeedEntityReminderDefaults extends Command
{
    protected $signature = 'reminders:seed-entity-defaults {--company= : Optional company id}';

    protected $description = 'Seed EntityReminderDefault + ReminderEmailTemplate rows for companies';

    public function handle(): int
    {
        $companyId = $this->option('company');

        $query = Company::query();
        if ($companyId !== null && $companyId !== '') {
            $query->where('id', (int) $companyId);
        }

        $count = 0;
        $query->orderBy('id')->chunkById(100, function ($companies) use (&$count) {
            foreach ($companies as $company) {
                EntityReminderDefault::seedDefaultsForCompany((int) $company->id);
                ReminderEmailTemplate::seedDefaultsForCompany((int) $company->id);
                $count++;
            }
        });

        $this->info("Seeded entity reminder defaults + email templates for {$count} compan(ies).");

        return self::SUCCESS;
    }
}
