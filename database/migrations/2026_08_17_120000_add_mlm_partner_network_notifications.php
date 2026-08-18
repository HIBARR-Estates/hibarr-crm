<?php

use App\Models\Company;
use App\Models\EmailNotificationSetting;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('mlm_commission_disputes')) {
            Schema::create('mlm_commission_disputes', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable()->index();
                $table->foreignId('commission_id')->constrained('mlm_commissions')->cascadeOnDelete();
                // Must match lead_agents.id (bigint unsigned), not unsignedInteger.
                $table->foreignId('agent_id')->constrained('lead_agents')->cascadeOnDelete();
                $table->string('reason', 100);
                $table->text('message')->nullable();
                $table->string('status', 20)->default('open');
                $table->unsignedInteger('resolved_by')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->text('resolution_note')->nullable();
                $table->timestamps();
            });
        }

        $setting = [
            'send_email' => 'yes',
            'send_push' => 'no',
            'send_slack' => 'no',
            'send_twilio' => 'no',
            'setting_name' => 'Partner Network (MLM) Notifications',
            'slug' => 'mlm-partner-network-notification',
        ];

        Company::query()->select('id')->orderBy('id')->chunk(100, function ($companies) use ($setting) {
            $rows = [];
            foreach ($companies as $company) {
                $exists = EmailNotificationSetting::query()
                    ->where('company_id', $company->id)
                    ->where('slug', $setting['slug'])
                    ->exists();

                if ($exists) {
                    continue;
                }

                $rows[] = array_merge($setting, [
                    'company_id' => $company->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            if ($rows !== []) {
                EmailNotificationSetting::insert($rows);
            }
        });
    }

    public function down(): void
    {
        EmailNotificationSetting::query()
            ->where('slug', 'mlm-partner-network-notification')
            ->delete();

        Schema::dropIfExists('mlm_commission_disputes');
    }
};
