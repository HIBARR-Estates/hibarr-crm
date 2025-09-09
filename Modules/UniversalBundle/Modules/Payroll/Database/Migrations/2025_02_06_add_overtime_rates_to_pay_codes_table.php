<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('pay_codes', 'regular_fixed_amount')) {
            Schema::table('pay_codes', function (Blueprint $table) {
                // Regular rate
                $table->decimal('regular_fixed_amount', 8, 2)->default(0);
                $table->decimal('regular_time_rate', 8, 2)->default(1.0);

                // Weekend rate
                $table->decimal('weekend_fixed_amount', 8, 2)->default(0);
                $table->decimal('weekend_time_rate', 8, 2)->default(1.5);

                // Holiday rate
                $table->decimal('holiday_fixed_amount', 8, 2)->default(0);
                $table->decimal('holiday_time_rate', 8, 2)->default(2.0);

                // Day off rate
                $table->decimal('day_off_fixed_amount', 8, 2)->default(0);
                $table->decimal('day_off_time_rate', 8, 2)->default(1.75);
            });
        }

        if (!Schema::hasColumn('overtime_requests', 'type')) {
            Schema::table('overtime_requests', function (Blueprint $table) {
                // Type
                $table->enum('type', ['working', 'holiday', 'dayoff'])->default('working');
            });
        }
    }

    public function down()
    {
        Schema::table('pay_codes', function (Blueprint $table) {
            $table->dropColumn([
                'regular_type',
                'regular_fixed_amount',
                'regular_time_rate',
                'weekend_type',
                'weekend_fixed_amount',
                'weekend_time_rate',
                'holiday_type',
                'holiday_fixed_amount',
                'holiday_time_rate',
                'day_off_type',
                'day_off_fixed_amount',
                'day_off_time_rate'
            ]);
        });
    }
};
