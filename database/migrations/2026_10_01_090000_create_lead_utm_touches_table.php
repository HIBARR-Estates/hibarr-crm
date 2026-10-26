<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const UTM_COLUMNS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_audience'];

    public function up(): void
    {
        // MySQL DDL isn't transactional: if an earlier run created the table
        // and then failed during the backfill, the table is still there.
        if (! Schema::hasTable('lead_utm_touches')) {
            Schema::create('lead_utm_touches', function (Blueprint $table) {
                $table->id();

                $table->unsignedInteger('lead_id');
                $table->foreign('lead_id')->references('id')->on('leads')->onDelete('cascade')->onUpdate('cascade');

                $table->string('utm_source')->nullable();
                $table->string('utm_medium')->nullable();
                $table->string('utm_campaign')->nullable();
                $table->string('utm_content')->nullable();
                $table->string('utm_term')->nullable();
                $table->string('utm_audience')->nullable();

                // Where the touch came from (api, bitrix_import, deal_import, ...)
                $table->string('origin', 50)->nullable();
                $table->boolean('is_first_touch')->default(false);

                $table->timestamps();

                $table->index(['lead_id', 'created_at']);
            });
        }

        // Backfill: each lead's existing UTM values become its first touch.
        // The join on leads skips lead_marketing rows whose lead no longer
        // exists (they would violate the foreign key); the NOT EXISTS makes a
        // re-run after a partial failure idempotent.
        $source = DB::table('lead_marketing as m')
            ->join('leads as l', 'l.id', '=', 'm.lead_id')
            ->where(function ($q) {
                foreach (self::UTM_COLUMNS as $col) {
                    $q->orWhereNotNull('m.'.$col);
                }
            })
            ->whereNotExists(function ($q) {
                $q->select(DB::raw(1))
                    ->from('lead_utm_touches as t')
                    ->whereColumn('t.lead_id', 'm.lead_id');
            })
            ->select(array_merge(
                ['m.lead_id'],
                array_map(fn ($col) => 'm.'.$col, self::UTM_COLUMNS),
                [DB::raw("'backfill'"), DB::raw('1'), 'm.created_at', 'm.created_at'],
            ));

        DB::table('lead_utm_touches')->insertUsing(
            array_merge(['lead_id'], self::UTM_COLUMNS, ['origin', 'is_first_touch', 'created_at', 'updated_at']),
            $source,
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_utm_touches');
    }
};
