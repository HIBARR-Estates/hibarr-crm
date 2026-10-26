<?php

namespace App\Email\Adapters\Mailtrap;

use SensitiveParameter;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\SocketStream;
use Symfony\Component\Mailer\Transport\TransportInterface;

/**
 * Builds the SMTP transport for one sandbox inbox. Separate from the adapter
 * so tests can swap in a transport that never opens a socket.
 */
class MailtrapSmtpFactory
{
    /**
     * @param  array<string, mixed>  $config  config('email.mailtrap')
     */
    public function make(string $username, #[SensitiveParameter] string $password, array $config): TransportInterface
    {
        $transport = new EsmtpTransport(
            (string) ($config['smtp']['host'] ?? 'sandbox.smtp.mailtrap.io'),
            (int) ($config['smtp']['port'] ?? 2525),
        );

        $transport->setUsername($username);
        $transport->setPassword($password);

        $stream = $transport->getStream();
        if ($stream instanceof SocketStream) {
            $stream->setTimeout((float) max(1, (int) ($config['timeout'] ?? 10)));
        }

        return $transport;
    }
}
