<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            if (! Schema::hasColumn('companies', 'fallback_voice_message_enabled')) {
                $table->boolean('fallback_voice_message_enabled')->default(false);
            }
            if (! Schema::hasColumn('companies', 'fallback_voice_message_url')) {
                $table->string('fallback_voice_message_url', 500)->nullable();
            }
            if (! Schema::hasColumn('companies', 'fallback_voice_message_text')) {
                $table->text('fallback_voice_message_text')->nullable();
            }
            if (! Schema::hasColumn('companies', 'fallback_voice_message_repeat_count')) {
                $table->unsignedTinyInteger('fallback_voice_message_repeat_count')->default(1);
            }
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $columnsToDrop = [];
            foreach ([
                'fallback_voice_message_enabled',
                'fallback_voice_message_url',
                'fallback_voice_message_text',
                'fallback_voice_message_repeat_count',
            ] as $column) {
                if (Schema::hasColumn('companies', $column)) {
                    $columnsToDrop[] = $column;
                }
            }

            if (! empty($columnsToDrop)) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
