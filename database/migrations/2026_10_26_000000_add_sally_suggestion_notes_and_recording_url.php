<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Extends the Sally insight with the scope-extension fields: the meeting
 * recording link, Sally's suggested notes, and the "original as received"
 * copies the write API exposes for prompt-improvement exports.
 *
 * Originals sit next to the working copies because a re-sync must never
 * overwrite what agents edited or un-log what they logged — the upsert
 * consults the *_edited_at columns and the suggestion log table to decide.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sally_meeting_insights', function (Blueprint $table) {
            if (! Schema::hasColumn('sally_meeting_insights', 'recording_url')) {
                $table->text('recording_url')->nullable();
            }
            if (! Schema::hasColumn('sally_meeting_insights', 'original_summary')) {
                $table->text('original_summary')->nullable();
            }
            if (! Schema::hasColumn('sally_meeting_insights', 'original_bullet_points')) {
                $table->json('original_bullet_points')->nullable();
            }
            // Agent working copy of Sally's suggested notes:
            // [{ id, type, text, edited }] — logged state lives in
            // sally_suggestion_logs, keyed by the OL-stable suggestion id.
            if (! Schema::hasColumn('sally_meeting_insights', 'suggested_notes')) {
                $table->json('suggested_notes')->nullable();
            }
            if (! Schema::hasColumn('sally_meeting_insights', 'original_suggested_notes')) {
                $table->json('original_suggested_notes')->nullable();
            }
            if (! Schema::hasColumn('sally_meeting_insights', 'summary_edited_at')) {
                $table->timestamp('summary_edited_at')->nullable();
            }
            if (! Schema::hasColumn('sally_meeting_insights', 'bullet_points_edited_at')) {
                $table->timestamp('bullet_points_edited_at')->nullable();
            }
        });

        if (! Schema::hasTable('sally_suggestion_logs')) {
            Schema::create('sally_suggestion_logs', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id');
                $table->unsignedInteger('sally_meeting_insight_id');
                // The OL-stable suggestion id from the insight's suggested_notes list.
                $table->string('suggestion_id', 64);
                $table->unsignedInteger('lead_id')->nullable();
                $table->unsignedBigInteger('deal_id')->nullable();
                // The CRM note the suggestion was logged as (DealNote or LeadNote).
                $table->unsignedInteger('note_id');
                $table->string('logged_mode', 16); // as_is | after_edit
                $table->longText('logged_text')->nullable();
                $table->unsignedInteger('logged_by')->nullable();
                $table->timestamp('logged_at');
                $table->timestamps();

                $table->unique(
                    ['sally_meeting_insight_id', 'suggestion_id'],
                    'sally_suggestion_logs_unique'
                );

                $table->foreign('company_id', 'fk_sally_suggestion_logs_company')
                    ->references('id')->on('companies')->cascadeOnDelete();
                $table->foreign('sally_meeting_insight_id', 'fk_sally_suggestion_logs_insight')
                    ->references('id')->on('sally_meeting_insights')->cascadeOnDelete();
                $table->foreign('lead_id', 'fk_sally_suggestion_logs_lead')
                    ->references('id')->on('leads')->nullOnDelete();
                $table->foreign('deal_id', 'fk_sally_suggestion_logs_deal')
                    ->references('id')->on('deals')->nullOnDelete();
                $table->foreign('logged_by', 'fk_sally_suggestion_logs_user')
                    ->references('id')->on('users')->nullOnDelete();

                $table->index(['company_id', 'logged_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('sally_suggestion_logs');

        Schema::table('sally_meeting_insights', function (Blueprint $table) {
            $columns = array_filter([
                'recording_url',
                'original_summary',
                'original_bullet_points',
                'suggested_notes',
                'original_suggested_notes',
                'summary_edited_at',
                'bullet_points_edited_at',
            ], fn (string $column) => Schema::hasColumn('sally_meeting_insights', $column));

            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
