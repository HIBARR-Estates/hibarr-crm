<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Leads may belong to many taxonomy categories. Existing scalar
     * `leads.category_id` becomes the primary (first) category and stays in
     * sync for filters, import, and deal-agent matching that still read it.
     */
    public function up(): void
    {
        if (! Schema::hasTable('lead_lead_category')) {
            Schema::create('lead_lead_category', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('lead_id');
                $table->unsignedInteger('lead_category_id');
                $table->timestamps();

                $table->unique(['lead_id', 'lead_category_id'], 'lead_lead_category_unique');
                $table->index('lead_category_id');

                $table->foreign('lead_id')
                    ->references('id')
                    ->on('leads')
                    ->onUpdate('CASCADE')
                    ->onDelete('CASCADE');

                $table->foreign('lead_category_id')
                    ->references('id')
                    ->on('lead_category')
                    ->onUpdate('CASCADE')
                    ->onDelete('CASCADE');
            });
        }

        // Backfill pivot from existing singular FK.
        if (Schema::hasColumn('leads', 'category_id')) {
            $now = now();
            DB::table('leads')
                ->whereNotNull('category_id')
                ->orderBy('id')
                ->chunkById(500, function ($leads) use ($now) {
                    $rows = [];
                    foreach ($leads as $lead) {
                        $rows[] = [
                            'lead_id' => $lead->id,
                            'lead_category_id' => $lead->category_id,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    }
                    if ($rows !== []) {
                        DB::table('lead_lead_category')->insertOrIgnore($rows);
                    }
                });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lead_lead_category');
    }
};
