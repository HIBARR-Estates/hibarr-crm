<?php

namespace Modules\RestAPI\Listeners;

use App\Events\NewExpenseEvent;
use App\Models\User;
use Illuminate\Support\Str;

class ExpensePushListener extends BasePushNotification
{

    public function handle(NewExpenseEvent $event)
    {
        $expense = $event->expense;

        if ($event->status == 'admin') {
            $role = $this->getUserRole($event->expense->user);
            $this->setMessage($this->message($expense, 'Expense Member', $role));
            $this->sendNotification($event->expense->user);

        }
        elseif ($event->status == 'member') {

            foreach (User::allAdmins($event->expense->company->id) as $user) {
                $role = $this->getUserRole($user);
                $this->setMessage($this->message($expense, 'Expense Admin', $role));
                $this->sendNotification($user);
            }

        }
        else {
            $role = $this->getUserRole($event->expense->user);
            $this->setMessage($this->updateMessage($expense, 'Expense Updated', $role));
            $this->sendNotification($event->expense->user);
        }
    }

    private function message($expense, $title, $role)
    {
        $type = Str::slug($title);

        $notificationData = [
            'title' => __('email.newExpense.subject'),
            'body' => $expense->item_name . ' ' .
                __('app.price') . ': ' .
                currency_format($expense->price, $expense->currency_id, true),
            'sound' => 'default',
            'badge' => 1,
            'id' => $expense->id,
            'type' => $type,
            'role' => $role,
        ];

        return $this->pushNotificationArray($notificationData);

    }

    private function updateMessage($expense, $title, $role)
    {
        $type = Str::slug($title);

        $notificationData = [
            'title' => __('email.expenseStatus.subject'),
            'body' => $expense->item_name . ' - ' . __('email.expenseStatus.text') . ' ' . $expense->status . '.',
            'sound' => 'default',
            'badge' => 1,
            'id' => $expense->id,
            'type' => $type,
            'role' => $role,
        ];

        return $this->pushNotificationArray($notificationData);

    }

}
