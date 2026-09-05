<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The personal dashboard's "my leads" queries (new/contacted/uncontacted
 * counts, no-next-step check) all filter by (company_id, lead_owner) with no
 * index behind lead_owner — every load scans the company's full leads table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->index(['company_id', 'lead_owner'], 'leads_owner_idx');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropIndex('leads_owner_idx');
        });
    }
};
