<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_agents', function (Blueprint $table) {
            $table->unsignedBigInteger('parent_agent_id')->nullable()->after('lead_category_id');

            $table->foreign('parent_agent_id')
                  ->references('id')->on('lead_agents')
                  ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('lead_agents', function (Blueprint $table) {
            $table->dropForeign(['parent_agent_id']);
            $table->dropColumn('parent_agent_id');
        });
    }
};
