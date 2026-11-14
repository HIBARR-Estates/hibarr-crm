<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The qualification script (questions + option labels) lives in OL and is only
 * ever loaded in the browser. The CRM stored just `segment_key` and the option
 * key, so server-side consumers (the lead AI summary) could not tell what was
 * asked or what the answer meant. Snapshot the human-readable text at save time.
 *
 * Both columns are nullable: answers saved before this migration simply have no
 * snapshot and are summarised from `answer_text` alone.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lead_qualification_answers')) {
            return;
        }

        Schema::table('lead_qualification_answers', function (Blueprint $table) {
            if (! Schema::hasColumn('lead_qualification_answers', 'question_label')) {
                $table->text('question_label')->nullable()->after('segment_key');
            }

            if (! Schema::hasColumn('lead_qualification_answers', 'answer_labels')) {
                $table->json('answer_labels')->nullable()->after('answer_values');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('lead_qualification_answers')) {
            return;
        }

        Schema::table('lead_qualification_answers', function (Blueprint $table) {
            foreach (['question_label', 'answer_labels'] as $column) {
                if (Schema::hasColumn('lead_qualification_answers', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
