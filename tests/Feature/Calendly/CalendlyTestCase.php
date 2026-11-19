<?php

namespace Tests\Feature\Calendly;

use App\Models\CalendlyMeetingLink;
use App\Models\Lead;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\LeadCoreFieldsTestCase;

/**
 * Builds the Calendly tables from the real migration, so the tests also prove
 * it runs, plus the few other tables the code under test reads.
 */
abstract class CalendlyTestCase extends LeadCoreFieldsTestCase
{
    protected int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        (require base_path('database/migrations/2026_11_19_000001_create_calendly_meeting_tables.php'))->up();

        Schema::create('lead_contact_methods', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('type');
            $table->string('identifier');
            $table->string('normalized')->nullable();
            $table->boolean('is_main')->default(false);
            $table->string('source_field')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('status')->nullable();
            $table->timestamps();
        });
    }

    protected function link(array $attributes = []): CalendlyMeetingLink
    {
        $link = new CalendlyMeetingLink;
        $link->fill(array_merge([
            'name' => 'Intro call',
            'url' => 'https://calendly.com/team/intro',
            'is_active' => true,
        ], $attributes));
        $link->company_id = $this->companyId;
        $link->save();

        return $link;
    }

    protected function lead(int $id, string $name, string $email): Lead
    {
        $lead = new Lead;
        $lead->id = $id;
        $lead->client_name = $name;
        $lead->client_email = $email;

        return $lead;
    }
}
