<?php

namespace App\Notifications;

use App\Models\Company;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

class EmployeePasswordResetNotification extends BaseNotification implements ShouldQueue
{
    use Queueable;

    private string $token;

    public function __construct(string $token, Company $company)
    {
        $this->token = $token;
        $this->company = $company;
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $resetEmail = $notifiable->getEmailForPasswordReset();

        $url = route('password.reset', [
            'token' => $this->token,
            'email' => $resetEmail,
        ], true);

        $url = getDomainSpecificUrl($url, $this->company);

        $build = parent::build($notifiable);

        try {
            $content = __('email.employeeSetPassword.content')
                . '<br>' . __('email.employeeSetPassword.expire')
                . '<br>' . __('email.employeeSetPassword.contentPassword');

            $title = __('email.employeeSetPassword.subject') . ' — ' . config('app.name');

            $build
                ->subject($title)
                ->view('mail.password-reset-notification', [
                    'url' => $url,
                    'content' => $content,
                    'actionText' => __('email.employeeSetPassword.actionButton'),
                    'notifiableName' => $notifiable->name ?? '',
                    'title' => $title,
                    'intro' => __('email.employeeSetPassword.content'),
                    'actionDescription' => __('email.employeeSetPassword.content'),
                ]);
        } finally {
            parent::resetLocale();
        }

        return $build;
    }
}

