<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A partner raising a hand about one of their own referrals.
 *
 * The partner sits outside the trust boundary and cannot contact the assigned
 * agent, so when a referral they introduced goes quiet their only recourse
 * today is email. This gives them one, scoped to a specific referral so it
 * cannot become a general support inbox.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('partner_flags')) {
            return;
        }

        Schema::create('partner_flags', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->index();

            // Both required. A flag with no referral behind it is a support
            // ticket, and this is deliberately not a support inbox.
            //
            // Types match the referenced keys exactly, which are not the same:
            // lead_agents.id is a bigint but leads.id is a plain int. MySQL
            // rejects a foreign key across differing integer widths.
            $table->unsignedBigInteger('lead_agent_id');
            $table->unsignedInteger('lead_id');

            $table->string('reason', 32);              // stalled | wrong_contact | other
            $table->text('message')->nullable();
            $table->string('status', 16)->default('open'); // open | acknowledged | resolved
            $table->text('response')->nullable();
            $table->unsignedInteger('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status'], 'partner_flags_company_status_index');
            $table->index(['lead_agent_id', 'lead_id'], 'partner_flags_agent_lead_index');

            // No unique on (lead_agent_id, lead_id, status): MySQL has no
            // partial unique index, so a three-column unique would happily
            // allow one open AND one acknowledged AND one resolved flag on the
            // same referral, which is not the rule anyone means. The controller
            // dedupes with firstOrCreate on the open ones instead.

            $table->foreign('lead_agent_id', 'partner_flags_lead_agent_id_foreign')
                ->references('id')->on('lead_agents')->onDelete('cascade');
            $table->foreign('lead_id', 'partner_flags_lead_id_foreign')
                ->references('id')->on('leads')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('partner_flags');
    }
};
