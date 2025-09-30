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

        Schema::create('developer_projects', function (Blueprint $table) {
            $table->id();
            // company_id
            $table->integer('company_id')->unsigned()->index();
            $table->foreign('company_id', 'developer_projects_company_id_fk')
                ->references('id')
                ->on('companies')
                ->onDelete('cascade');
            //name, description, images, developer_id
            $table->string('name');
            $table->text('description')->nullable();
            $table->json('images')->nullable();
            $table->foreignId('developer_id')->constrained('developers')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('developer_projects');
    }
};
