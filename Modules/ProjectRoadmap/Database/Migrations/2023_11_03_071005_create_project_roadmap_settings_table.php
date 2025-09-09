<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\ProjectRoadmap\Entities\ProjectRoadmapSetting;

return new class extends Migration {

    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        \App\Models\Module::validateVersion(ProjectRoadmapSetting::MODULE_NAME);

        if (!Schema::hasTable('project_roadmap_settings')) {
            Schema::create('project_roadmap_settings', function (Blueprint $table) {
                $table->id();
                $table->string('purchase_code')->nullable();
                $table->timestamp('supported_until')->nullable();
                $table->boolean('notify_update')->default(1);
                $table->timestamps();
            });

            ProjectRoadmapSetting::create([]);
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('e_invoice_settings');
    }

};
