<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('qualification_script_settings')) {
            Schema::create('qualification_script_settings', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id');
                // OL template id — the script is owned by OL, only the mapping is ours.
                $table->string('template_id', 191);
                $table->string('template_name')->nullable();
                $table->boolean('auto_write')->default(true);
                $table->timestamps();

                $table->unique(['company_id', 'template_id'], 'qual_script_settings_company_template_unique');
            });
        }

        if (! Schema::hasTable('qualification_field_mappings')) {
            Schema::create('qualification_field_mappings', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('script_setting_id');
                $table->string('segment_key', 191);
                // Lead target: a core column name, or `custom_field_<id>`.
                $table->string('lead_field', 191)->nullable();
                $table->string('write_mode', 32)->default('fill_empty');
                // { "<option key>": "<lead field value>" }
                $table->json('option_map')->nullable();
                $table->timestamps();

                $table->foreign('script_setting_id', 'qual_field_mappings_setting_id_foreign')
                    ->references('id')
                    ->on('qualification_script_settings')
                    ->onUpdate('cascade')
                    ->onDelete('cascade');

                $table->unique(['script_setting_id', 'segment_key'], 'qual_field_mappings_setting_segment_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('qualification_field_mappings');
        Schema::dropIfExists('qualification_script_settings');
    }
};
