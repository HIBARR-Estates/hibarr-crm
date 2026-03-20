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
        ], false);

        $url = getDomainSpecificUrl($url, $this->company);

        $content = __('email.forgetPassword.content')
            . '<br>' . __('email.forgetPassword.expire')
            . '<br>' . __('email.forgetPassword.contentPassword');

        $title = __('email.forgetPassword.subject') . ' ' . config('app.name') . '.';

        $build = parent::build($notifiable);

        $build
            ->subject($title)
            ->view('mail.password-reset-notification', [
                'url' => $url,
                'content' => $content,
                'actionText' => __('email.forgetPassword.actionButton'),
                'notifiableName' => $notifiable->name ?? '',
                'title' => $title,
                'intro' => __('email.forgetPassword.content'),
                'actionDescription' => __('email.forgetPassword.content'),
            ]);

        parent::resetLocale();

        return $build;
    }
}

