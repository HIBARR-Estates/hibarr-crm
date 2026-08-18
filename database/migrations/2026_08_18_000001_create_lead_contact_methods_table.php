<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Alternate/historical email and phone identifiers for a lead.
     * leads.client_email / leads.mobile remain the identifying columns;
     * is_main rows on this table mirror those (mobile, else cell for phone).
     */
    public function up(): void
    {
        Schema::create('lead_contact_methods', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->index();
            $table->unsignedInteger('company_id')->nullable()->index();
            $table->string('type', 16);
            $table->string('identifier');
            $table->string('normalized');
            $table->boolean('is_main')->default(false);
            $table->string('source_field', 32)->nullable();
            $table->timestamps();

            $table->unique(['lead_id', 'type', 'normalized'], 'lead_contact_methods_lead_type_normalized_unique');
            $table->index(['lead_id', 'type', 'is_main'], 'lead_contact_methods_lead_type_main_index');

            $table->foreign('lead_id')
                ->references('id')
                ->on('leads')
                ->onUpdate('CASCADE')
                ->onDelete('CASCADE');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_contact_methods');
    }
};
