<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {

        if (! Schema::hasColumn('asset_lending_history', 'lender_id')) {

            \DB::statement('SET FOREIGN_KEY_CHECKS=0;');

            Schema::table('asset_lending_history', function (Blueprint $table) {
                $table->unsignedInteger('lender_id')->after('user_id');
                $table->foreign('lender_id')->references('id')->on('users')->onUpdate('cascade')->onDelete('cascade');

                $table->unsignedInteger('returner_id')->after('lender_id')->nullable();
                $table->foreign('returner_id')->references('id')->on('users')->onUpdate('cascade')->onDelete('cascade');
            });

            \DB::statement('SET FOREIGN_KEY_CHECKS=1;');
        }

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        //
    }
};
