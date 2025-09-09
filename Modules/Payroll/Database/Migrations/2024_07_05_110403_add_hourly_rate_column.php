<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('employee_details', 'overtime_hourly_rate')) {
            Schema::table('employee_details', function (Blueprint $table) {
                $table->double('overtime_hourly_rate', 16, 2)->nullable()->comment('This field is only for overtime calculation');
            });
        }

        Schema::create('pay_codes', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->integer('company_id')->unsigned()->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->string('name')->nullable();
            $table->string('code')->nullable();
            $table->double('time', 20)->nullable();
            $table->boolean('fixed')->default(0);
            $table->double('fixed_amount', 20)->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('overtime_policies', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->integer('company_id')->unsigned()->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->unsignedBigInteger('pay_code_id');
            $table->foreign('pay_code_id')->references('id')->on('pay_codes')->onDelete('cascade')->onUpdate('cascade');
            $table->boolean('working_days')->default(0);
            $table->string('name')->nullable();
            $table->boolean('week_end')->default(0);
            $table->boolean('holiday')->default(0);
            $table->integer('request_before_days')->nullable();
            $table->boolean('allow_reporting_manager')->default(0);
            $table->text('allow_roles')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
        });

        Schema::create('overtime_policy_employees', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->integer('company_id')->unsigned()->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->integer('user_id')->unsigned();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade')->onUpdate('cascade');
            $table->unsignedBigInteger('overtime_policy_id');
            $table->foreign('overtime_policy_id')->references('id')->on('overtime_policies')->onDelete('cascade')->onUpdate('cascade');
            $table->timestamps();
        });

        Schema::create('overtime_requests', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->integer('company_id')->unsigned()->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->integer('user_id')->unsigned();
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade')->onUpdate('cascade');
            $table->unsignedBigInteger('overtime_policy_id');
            $table->foreign('overtime_policy_id')->references('id')->on('overtime_policies')->onDelete('cascade')->onUpdate('cascade');
            $table->date('date')->nullable();
            $table->double('hours')->default(0);
            $table->double('minutes')->default(0);
            $table->double('amount')->default(0);
            $table->text('overtime_reason')->nullable();
            $table->enum('type', ['working', 'holiday', 'dayoff'])->default('working');
            $table->enum('status', ['accept', 'reject', 'pending'])->default('pending');
            $table->enum('save_type', ['draft', 'save'])->default('draft');
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->integer('action_by')->unsigned()->nullable();
            $table->foreign('action_by')->references('id')->on('users')->onDelete('cascade')->onUpdate('cascade');
            $table->string('batch_key', 20)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
    }

};
