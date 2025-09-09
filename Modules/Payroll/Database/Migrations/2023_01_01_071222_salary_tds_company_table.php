<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {

        $tables = [
            'salary_tds',
        ];

        $count = Company::count();

        try {

            foreach ($tables as $table) {

                if (! Schema::hasColumn($table, 'company_id')) {
                    Schema::table($table, function (Blueprint $table) {
                        $table->integer('company_id')->unsigned()->nullable()->after('id');
                        $table->foreign('company_id')->references('id')
                            ->on('companies')->onDelete('cascade')->onUpdate('cascade');
                    });
                }

                if (Schema::hasColumn($table, 'company_id') && $count === 1) {
                    DB::table($table)->update(['company_id' => 1]);
                }
            }

        } catch (Exception $e) {
            echo $e->getMessage();
        }

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {

    }
};
