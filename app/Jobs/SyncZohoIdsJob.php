<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncZohoIdsJob implements ShouldQueue
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
        //TODO: Implement a service to be called to do this to ensure a DRY logic to be used in observer, job, and on zoho sso login
        // Also ensure to batch this to avoid overloading the zoho api rate limits, check the rate limit and put as config to ensure predicatable behaviour
        $employees = EmployeeDetails::whereNull('zoho_id')->with('user')->get();

        foreach ($employees as $employee) {
            // Call Zoho API to create/link employee and populate zoho_id
        }
    }
}
