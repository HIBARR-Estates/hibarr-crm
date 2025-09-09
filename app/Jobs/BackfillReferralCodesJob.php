<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class BackfillReferralCodesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        //
        Employee::doesntHave('referralCode') // only employees without codes
            ->chunkById(100, function ($employees) {
                foreach ($employees as $employee) {
                    ReferralCode::firstOrCreate(
                        ['employee_id' => $employee->id],
                        ['code' => ReferralCode::generateCode()]
                    );
                }
            });
    }
}
