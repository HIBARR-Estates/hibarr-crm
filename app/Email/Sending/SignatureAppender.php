<?php

namespace App\Email\Sending;

use App\Email\Models\EmailSignature;

/**
 * Appends a connection signature once to outbound bodies. The composer keeps
 * the signature out of the editable field and calls this at send time.
 */
class SignatureAppender
{
    /**
     * @return array{text: string|null, html: string|null}
     */
    public function apply(?EmailSignature $signature, ?string $textBody, ?string $htmlBody): array
    {
        if ($signature === null || ! $signature->hasContent()) {
            return ['text' => $textBody, 'html' => $htmlBody];
        }

        $text = $this->appendText($textBody, $signature->text_body, $signature->html_body);
        $html = $this->appendHtml($htmlBody, $signature->html_body, $signature->text_body);

        return ['text' => $text, 'html' => $html];
    }

    private function appendText(?string $body, ?string $signatureText, ?string $signatureHtml): ?string
    {
        $sig = trim((string) $signatureText);

        if ($sig === '') {
            $sig = trim(html_entity_decode(strip_tags((string) $signatureHtml), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }

        if ($sig === '') {
            return $body;
        }

        $base = rtrim((string) $body);

        return ($base === '' ? '' : $base."\n\n")."--\n".$sig;
    }

    private function appendHtml(?string $body, ?string $signatureHtml, ?string $signatureText): ?string
    {
        $sig = trim((string) $signatureHtml);

        if ($sig === '') {
            $plain = trim((string) $signatureText);
            if ($plain === '') {
                return $body;
            }
            $sig = nl2br(e($plain), false);
        }

        $base = rtrim((string) $body);
        $block = '<div class="email-signature"><br>--<br>'.$sig.'</div>';

        return ($base === '' ? '' : $base).$block;
    }
}
