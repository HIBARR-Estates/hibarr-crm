<?php

namespace App\Observers;

use App\Enums\MaritalStatus;
use Illuminate\Support\Carbon;
use App\Models\EmployeeDetails;
use App\Models\EmployeeLeaveQuota;
use App\Events\NewUserSlackEvent;
use App\Models\User;
use App\Models\ReferralCode;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Artisan;

class EmployeeDetailsObserver
{

    public function saving(EmployeeDetails $detail)
    {
        if (!isRunningInConsoleOrSeeding() && auth()->check()) {
            $detail->last_updated_by = user()->id;
        }
    }

    public function creating(EmployeeDetails $detail)
    {
        if (!isRunningInConsoleOrSeeding() && auth()->check()) {
            $detail->added_by = user()->id;
        }

        $detail->company_id = $detail->user->company_id;

        if (is_null($detail->marital_status)) {
            $detail->marital_status = MaritalStatus::Single;
        }

    }

    public function created(EmployeeDetails $detail)
    {
        $settings = company();

        $user = $detail->user;

        Artisan::call('app:recalculate-leaves-quotas ' . $detail->company_id . ' ' . $user->id);

        event(new NewUserSlackEvent($user));

        // TODO: Call Zoho API to create/link employee and populate zoho_id, if not already linked
  
        // create a referral code for the employee
        // Use firstOrCreate to avoid race conditions and duplicate key errors
        ReferralCode::firstOrCreate(
            ['employee_id' => $detail->id],
            ['referral_code' => ReferralCode::generateCode($detail->company?->name ?? null)]
        );
    }

    public function updated(EmployeeDetails $detail)
    {
        if (user() && $detail->isDirty('joining_date'))  {
            Artisan::call('app:recalculate-leaves-quotas ' . $detail->company_id . ' ' . $detail->user_id);
        }

    }

}
