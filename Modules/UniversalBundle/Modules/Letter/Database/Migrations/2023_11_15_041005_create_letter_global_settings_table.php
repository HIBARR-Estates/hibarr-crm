<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Modules\Letter\Entities\LetterSetting;

return new class extends Migration {

    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        \App\Models\Module::validateVersion(LetterSetting::MODULE_NAME);

        if (!Schema::hasTable('letter_settings')) {
            Schema::create('letter_settings', function (Blueprint $table) {
                $table->id();
                $table->string('purchase_code')->nullable();
                $table->timestamp('supported_until')->nullable();
                $table->timestamp('purchased_on')->nullable();
                $table->boolean('notify_update')->default(1);
                $table->string('license_type', 20)->nullable();
                $table->timestamps();
            });

            LetterSetting::create([]);
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('letter_settings');
    }

};
