<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {

        Schema::create('developers', function (Blueprint $table) {
            $table->id();
            // company_id
            $table->integer('company_id')->unsigned()->index();
            $table->foreign('company_id', 'developers_company_id_fk')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade');
            // name, logo, description
            $table->string('name');
            $table->string('logo')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('developers');
    }
};
