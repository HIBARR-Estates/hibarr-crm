<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A copy, in the CRM, of every lead entry the backend (OL) recorded: which channel a lead came
     * through, each time. OL is the source of truth for the channel tree; this is the read model
     * the automations and the lead's entry history use, so routing never has to call OL.
     *
     * `ol_entry_uuid` is unique: a retried delivery of the same entry is ignored, which is what
     * makes an automation run at most once per entry.
     */
    public function up(): void
    {
        Schema::create('lead_entries', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->index();
            $table->unsignedInteger('lead_id');
            $table->uuid('ol_entry_uuid')->unique();

            // The channel as it was when the entry happened (a snapshot, so history stays true
            // after OL renames, moves or archives it).
            $table->uuid('channel_uuid');
            $table->string('channel_key', 100);
            $table->string('channel_name', 191);
            $table->string('channel_type', 48);
            $table->string('channel_family', 24)->nullable();
            $table->string('channel_path', 512);
            $table->json('channel_ancestor_uuids');
            $table->json('channel_tags');

            // The object the lead submitted to (a webinar session, a form, a package...).
            $table->string('source_entity_type', 32)->nullable();
            $table->unsignedInteger('source_entity_id')->nullable();
            $table->string('source_entity_key', 191)->nullable();
            $table->string('source_label', 255)->nullable();

            $table->boolean('is_new_lead')->default(false);
            $table->string('resolved_by', 16);
            $table->timestamp('occurred_at');

            // Who or what brought the lead (context, kept apart from the channel).
            $table->unsignedInteger('referral_ol_agent_id')->nullable();
            $table->unsignedInteger('referral_user_id')->nullable()->index();
            $table->unsignedInteger('partner_ol_agent_id')->nullable();
            $table->unsignedInteger('partner_user_id')->nullable()->index();
            $table->string('campaign_key', 255)->nullable()->index();
            $table->string('campaign_matched_by', 24)->nullable();
            $table->string('campaign_value', 255)->nullable();
            $table->string('campaign_label', 255)->nullable();
            $table->uuid('attribution_link_uuid')->nullable()->index();
            $table->string('utm_source', 191)->nullable();
            $table->string('utm_medium', 191)->nullable();
            $table->string('utm_campaign', 191)->nullable();
            $table->string('form_key', 100)->nullable();
            $table->string('language', 8)->nullable();

            // When routing (the lead_entry_received automations) finished for this entry. Null while it
            // has not, so a redelivery after a failure runs it again, and only then.
            $table->timestamp('routed_at')->nullable();

            // The block as received, for audit and for fields added later.
            $table->json('payload')->nullable();

            $table->timestamps();

            $table->index(['lead_id', 'occurred_at']);
            $table->index(['company_id', 'channel_uuid', 'occurred_at'], 'lead_entries_company_channel_occurred');
            $table->foreign('lead_id')->references('id')->on('leads')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_entries');
    }
};
