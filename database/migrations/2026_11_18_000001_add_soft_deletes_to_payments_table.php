<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A cancelled payment request can be deleted. The row is kept (soft
     * delete) so there is a trace of who removed it and when, but every
     * query on Payment excludes it, so it counts toward nothing.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->softDeletes();
            $table->unsignedInteger('deleted_by_user_id')->nullable()->after('deleted_at');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['deleted_by_user_id', 'deleted_at']);
        });
    }
};
