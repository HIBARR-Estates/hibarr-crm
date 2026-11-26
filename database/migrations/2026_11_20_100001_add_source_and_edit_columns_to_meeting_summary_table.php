<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * A summary can now be written or corrected by a person. `source` says
     * which it is, so a later automatic push does not overwrite someone's
     * words: it is kept in `ai_summary_object` instead, and the person can
     * choose to take it. Existing rows are all automatic.
     */
    public function up(): void
    {
        Schema::table('meeting_summary', function (Blueprint $table) {
            if (! Schema::hasColumn('meeting_summary', 'source')) {
                $table->string('source', 16)->default('ai');
            }
            if (! Schema::hasColumn('meeting_summary', 'ai_summary_object')) {
                $table->json('ai_summary_object')->nullable();
            }
            if (! Schema::hasColumn('meeting_summary', 'edited_by')) {
                // No foreign key: the user may be deleted and the summary stays.
                $table->unsignedInteger('edited_by')->nullable();
            }
            if (! Schema::hasColumn('meeting_summary', 'edited_at')) {
                $table->timestamp('edited_at')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('meeting_summary', function (Blueprint $table) {
            foreach (['source', 'ai_summary_object', 'edited_by', 'edited_at'] as $column) {
                if (Schema::hasColumn('meeting_summary', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
