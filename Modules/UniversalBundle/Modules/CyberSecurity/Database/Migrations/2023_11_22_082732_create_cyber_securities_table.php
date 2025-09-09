<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;
use Modules\CyberSecurity\Entities\CyberSecurity;

return new class extends Migration
{

    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (!Schema::hasTable('cyber_securities')) {
            Schema::create('cyber_securities', function (Blueprint $table) {
                $table->id();
                $table->integer('max_retries')->default(3);
                $table->string('email')->nullable();
                $table->integer('lockout_time')->default(2);
                $table->integer('max_lockouts')->default(3);
                $table->integer('extended_lockout_time')->default(1);
                $table->integer('reset_retries')->default(24);
                $table->integer('alert_after_lockouts')->default(2);
                $table->integer('user_timeout')->default(10);
                $table->boolean('ip_check')->default(false);
                $table->string('ip')->nullable();
                $table->boolean('unique_session')->default(false);
                $table->timestamps();
            });

            CyberSecurity::create([]);
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('cyber_securities');
    }

};
