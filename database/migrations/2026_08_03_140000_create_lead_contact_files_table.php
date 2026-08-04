<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Standalone lead-contact attachments (not deal_files).
     * File-typed custom fields stay in custom_fields_data; this table is for
     * freeform multi-file uploads from the lead Files tab.
     */
    public function up(): void
    {
        Schema::create('lead_contact_files', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->index();
            $table->unsignedInteger('user_id')->index();
            $table->string('filename', 200);
            $table->string('hashname', 200)->default('');
            $table->string('size', 200)->nullable();
            $table->text('description')->nullable();
            $table->text('external_url')->nullable();
            $table->string('object_path', 500)->nullable();
            $table->unsignedInteger('added_by')->nullable()->index();
            $table->unsignedInteger('last_updated_by')->nullable()->index();
            $table->timestamps();

            $table->foreign('lead_id')
                ->references('id')
                ->on('leads')
                ->onUpdate('CASCADE')
                ->onDelete('CASCADE');
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onUpdate('CASCADE')
                ->onDelete('CASCADE');
            $table->foreign('added_by')
                ->references('id')
                ->on('users')
                ->onUpdate('CASCADE')
                ->onDelete('SET NULL');
            $table->foreign('last_updated_by')
                ->references('id')
                ->on('users')
                ->onUpdate('CASCADE')
                ->onDelete('SET NULL');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_contact_files');
    }
};
