<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
//        DB::statement("ALTER TABLE `payroll_settings` DROP FOREIGN KEY `payroll_settings_currency_id_foreign`");
//        DB::statement("ALTER TABLE `payroll_settings` ADD CONSTRAINT `payroll_settings_currency_id_foreign` FOREIGN KEY (`currency_id`) REFERENCES `currencies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE");
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
