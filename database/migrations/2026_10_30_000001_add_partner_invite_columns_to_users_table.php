<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'partner_invite_status')) {
                $table->string('partner_invite_status', 16)->nullable()->after('status');
            }
            if (! Schema::hasColumn('users', 'partner_invited_at')) {
                $table->timestamp('partner_invited_at')->nullable()->after('partner_invite_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'partner_invited_at')) {
                $table->dropColumn('partner_invited_at');
            }
            if (Schema::hasColumn('users', 'partner_invite_status')) {
                $table->dropColumn('partner_invite_status');
            }
        });
    }
};
