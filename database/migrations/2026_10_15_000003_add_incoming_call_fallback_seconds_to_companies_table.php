<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('companies', 'incoming_call_fallback_seconds')) {
            return;
        }

        Schema::table('companies', function (Blueprint $table) {
            $table->unsignedSmallInteger('incoming_call_fallback_seconds')
                ->default(20);
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('companies', 'incoming_call_fallback_seconds')) {
            return;
        }

        Schema::table('companies', function (Blueprint $table) {
            $table->dropColumn('incoming_call_fallback_seconds');
        });
    }
};
