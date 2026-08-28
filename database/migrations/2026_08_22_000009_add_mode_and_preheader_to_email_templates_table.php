<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('email_templates', function (Blueprint $table) {
            // 'custom' (default — full local design, this app's Subject/Body is
            // the whole email) vs 'plunk_body' (Body is just a fragment injected
            // into a required base Plunk template as its `body` variable).
            $table->string('mode', 20)->default('custom')->after('name');
            $table->string('preheader')->nullable()->after('subject');
        });
    }

    public function down(): void
    {
        Schema::table('email_templates', function (Blueprint $table) {
            $table->dropColumn(['mode', 'preheader']);
        });
    }
};
