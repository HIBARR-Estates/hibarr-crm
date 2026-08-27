<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Log;

/**
 * Templated Lead automation email via ReminderEmailTemplate / Plunk headers.
 */
class LeadAutomationEmailNotification extends BaseNotification
{
    /**
     * @param  array<string, mixed>  $variables
     */
    public function __construct(
        protected string $plunkTemplateId,
        protected array $variables,
        $company = null,
    ) {
        $this->company = $company;
        $this->initUnsRouting();
    }

    /**
     * @param  mixed  $notifiable
     * @return list<string>
     */
    public function via($notifiable): array
    {
        return ['mail'];
    }

    /**
     * @param  mixed  $notifiable
     */
    public function toMail($notifiable): MailMessage
    {
        $build = parent::build($notifiable);
        $build->subject(__('Lead automation'));
        $build->markdown('mail.email', [
            'content' => ' ',
            'url' => '',
            'themeColor' => $this->company?->header_color ?? '#000000',
            'actionText' => '',
            'notifiableName' => '',
        ]);

        try {
            $this->attachPlunkTemplate($build, $this->plunkTemplateId, $this->variables);
        } catch (\Throwable $e) {
            Log::warning('LeadAutomationEmailNotification: failed to attach Plunk template', [
                'error' => $e->getMessage(),
            ]);
        }

        return $build;
    }
}
