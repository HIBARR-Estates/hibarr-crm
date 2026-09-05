<?php

namespace App\Mail;

use App\Services\Notifications\MailDeliveryContext;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Symfony\Component\Mime\Email;

class DealAutomationTemplateEmail extends Mailable
{
    use Queueable, SerializesModels;

    public string $emailSubject;

    public string $bodyHtml;

    public ?string $preheader;

    public ?string $plunkTemplateId;

    public array $plunkVariables;

    /**
     * Origin of this email (automation/deal/lead ids + a correlation id),
     * carried to UnsRoutingTransport so the delivery it performs can be
     * attributed back to the automation run that asked for it.
     *
     * @var array<string, mixed>
     */
    public array $deliveryContext;

    /**
     * @param  array<string, mixed>  $plunkVariables
     * @param  array<string, mixed>  $deliveryContext
     */
    public function __construct(string $emailSubject, string $bodyHtml, ?string $preheader = null, ?string $plunkTemplateId = null, array $plunkVariables = [], array $deliveryContext = [])
    {
        $this->emailSubject = $emailSubject;
        $this->bodyHtml = $bodyHtml;
        $this->preheader = $preheader;
        $this->plunkTemplateId = $plunkTemplateId;
        $this->plunkVariables = $plunkVariables;
        $this->deliveryContext = $deliveryContext;
    }

    public function build()
    {
        $fromEmail = config('mail.mailers.smtp.username') ?: config('mail.from.address');
        $fromName = config('mail.from.name');

        $mail = $this->from($fromEmail, $fromName)
            ->subject($this->emailSubject)
            ->view('mail.deal-automation-template', [
                'bodyHtml' => $this->bodyHtml,
                'preheader' => $this->preheader,
                'subject' => $this->emailSubject,
            ]);

        if ($this->deliveryContext !== []) {
            $context = $this->deliveryContext;

            $mail->withSymfonyMessage(function (Email $message) use ($context): void {
                MailDeliveryContext::attach($message, $context);
            });
        }

        // When a Plunk template is configured, route through the UNS/Plunk transport
        // (app/Services/Notifications/UnsRoutingTransport.php) via these headers — the
        // rendered subject/body above stays as the automatic SMTP fallback if that
        // send fails (UnsRoutingTransport falls back to this same Email message).
        if (! empty($this->plunkTemplateId)) {
            $templateId = $this->plunkTemplateId;
            $variables = $this->plunkVariables;

            $mail->withSymfonyMessage(function (Email $message) use ($templateId, $variables): void {
                $message->getHeaders()->addTextHeader('X-Uns-Route', 'true');
                $message->getHeaders()->addTextHeader('X-Plunk-Template-Id', $templateId);
                $message->getHeaders()->addTextHeader('X-Plunk-Template-Variables', base64_encode((string) json_encode($variables)));
            });
        }

        return $mail;
    }
}
