<?php

namespace App\Observers;

use App\Events\NewUserEvent;
use App\Models\TicketAgentGroups;
use App\Models\User;
use App\Services\PartnerInviteService;
use App\Traits\StoreHeaders;

class UserObserver
{

    use StoreHeaders;

    public function saving(User $user)
    {
        if (!isRunningInConsoleOrSeeding()) {
            if ($user->isDirty('status') && $user->status == 'deactive') {
                // Remove as ticket agent
                TicketAgentGroups::whereAgentId($user->id)->delete();
            }
        }

        if ($user->exists && ($user->isDirty('status') || $user->isDirty('email'))) {
            app(PartnerInviteService::class)->syncLifecycle($user);
        }

        session()->forget('user');
    }

    public function created(User $user)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $sendMail = true;

            if (request()->has('sendMail') && request()->sendMail == 'no') {
                $sendMail = false;
            }

            if ($sendMail && request()->password != '' && auth()->check() && request()->email != '') {
                event(new NewUserEvent($user, request()->password));
            }
        }
    }

    public function creating(User $model)
    {
        if (company()) {
            $model->company_id = company()->id;
        }

        $this->storeHeaders($model);

    }

}
