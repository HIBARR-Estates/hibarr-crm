<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A company-managed catalog of Meta Conversion API event names + a default
 * value each — lets a deal_automations "meta_conversion" action pick from a
 * curated list (Settings > Automation > Meta Events) instead of free-typing
 * an event name and value on every automation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('meta_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->decimal('value', 12, 2)->nullable();
            $table->string('description')->nullable();
            $table->timestamps();

            $table->foreign('company_id')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->unique(['company_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meta_events');
    }
};
