<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('deal_package')) {
            Schema::create('deal_package', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('deal_id');
                $table->unsignedBigInteger('package_id');
                $table->timestamps();

                $table->foreign('deal_id')->references('id')->on('deals')->onDelete('cascade');
                $table->foreign('package_id')->references('id')->on('packages')->onDelete('cascade');
            });
        }

        // Migrate existing data
        $deals = DB::table('deals')->whereNotNull('package_id')->get();
        foreach ($deals as $deal) {
            DB::table('deal_package')->insert([
                'deal_id' => $deal->id,
                'package_id' => $deal->package_id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Drop the old column
        Schema::table('deals', function (Blueprint $table) {
            // Check if foreign key exists before dropping to avoid errors if it was already dropped
            $foreignKeyExists = DB::selectOne(
                "SELECT CONSTRAINT_NAME 
                 FROM information_schema.TABLE_CONSTRAINTS 
                 WHERE TABLE_SCHEMA = DATABASE() 
                 AND TABLE_NAME = 'deals' 
                 AND CONSTRAINT_NAME = 'deals_package_id_foreign' 
                 AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
            );

            if ($foreignKeyExists) {
                $table->dropForeign(['package_id']);
            }

            if (Schema::hasColumn('deals', 'package_id')) {
                $table->dropColumn('package_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasColumn('deals', 'package_id')) {
            Schema::table('deals', function (Blueprint $table) {
                $table->unsignedBigInteger('package_id')->nullable()->after('pipeline_stage_id');
                $table->foreign('package_id')->references('id')->on('packages')->onDelete('set null')->onUpdate('cascade');
            });
        }

        // Restore data (taking the first package if multiple exist)
        if (Schema::hasTable('deal_package')) {
            $dealPackages = DB::table('deal_package')->get();
            foreach ($dealPackages as $dp) {
                // Only update if package_id is null to avoid overwriting with subsequent packages
                DB::table('deals')
                    ->where('id', $dp->deal_id)
                    ->whereNull('package_id')
                    ->update(['package_id' => $dp->package_id]);
            }
        }

        Schema::dropIfExists('deal_package');
    }
};
