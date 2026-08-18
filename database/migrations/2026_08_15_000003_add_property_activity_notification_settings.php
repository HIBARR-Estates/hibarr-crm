<?php

use App\Models\Company;
use App\Models\EmailNotificationSetting;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Admin toggles for property lifecycle and exposé notifications.
     */
    public function up(): void
    {

        $definitions = [

            ['setting_name' => 'Property Activity Notification', 'slug' => 'property-activity-notification'],

            ['setting_name' => 'Exposé Ready', 'slug' => 'expose-ready'],

        ];

        Company::query()->select('id')->each(function (Company $company) use ($definitions) {

            $reference = EmailNotificationSetting::query()

                ->where('company_id', $company->id)

                ->where('slug', 'deal-activity-notification')

                ->first();

            foreach ($definitions as $definition) {

                $exists = EmailNotificationSetting::query()

                    ->where('company_id', $company->id)

                    ->where('slug', $definition['slug'])

                    ->exists();

                if ($exists) {

                    continue;

                }

                EmailNotificationSetting::create([

                    'company_id' => $company->id,

                    'setting_name' => $definition['setting_name'],

                    'slug' => $definition['slug'],

                    'send_email' => $reference?->send_email ?? 'yes',

                    'send_push' => 'no',

                    'send_slack' => 'no',

                ]);

            }

        });

    }

    public function down(): void
    {

        EmailNotificationSetting::query()

            ->whereIn('slug', ['property-activity-notification', 'expose-ready'])

            ->delete();

    }
};
