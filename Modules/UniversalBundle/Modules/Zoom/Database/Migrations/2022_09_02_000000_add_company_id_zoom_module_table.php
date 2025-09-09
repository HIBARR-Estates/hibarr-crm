<?php

use App\Models\Company;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Zoom\Entities\ZoomSetting;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {

        \App\Models\Module::validateVersion(ZoomSetting::MODULE_NAME);

        $tables = ['zoom_meetings', 'zoom_categories', 'zoom_setting'];

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
            info($e->getMessage());
        }

    }
};
