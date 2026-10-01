<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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

        // Backfill: each lead's existing UTM values become its first touch.
        $rows = DB::table('lead_marketing')
            ->whereNotNull('lead_id')
            ->where(function ($q) {
                foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_audience'] as $col) {
                    $q->orWhereNotNull($col);
                }
            })
            ->get();

        foreach ($rows->chunk(500) as $chunk) {
            DB::table('lead_utm_touches')->insert($chunk->map(fn ($m) => [
                'lead_id' => $m->lead_id,
                'utm_source' => $m->utm_source,
                'utm_medium' => $m->utm_medium,
                'utm_campaign' => $m->utm_campaign,
                'utm_content' => $m->utm_content,
                'utm_term' => $m->utm_term,
                'utm_audience' => $m->utm_audience,
                'origin' => 'backfill',
                'is_first_touch' => true,
                'created_at' => $m->created_at,
                'updated_at' => $m->created_at,
            ])->all());
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_utm_touches');
    }
};
