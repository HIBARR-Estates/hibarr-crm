<?php

namespace App\Email\Sending;

use App\Email\Data\Draft;
use App\Email\Data\EmailAddress;
use App\Email\Data\SendResult;
use App\Email\Data\SendStatus;
use App\Email\EmailFeature;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Enums\SendRecipientKind;
use App\Email\Enums\SendRecipientStatus;
use App\Email\Exceptions\EmailUnavailableException;
use App\Email\Exceptions\MailTransportException;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailSendAttempt;
use App\Email\Models\EmailSendRecipient;
use App\Email\Transport\MailTransportFactory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * The send-state machine. It lives here, in the CRM: adapters only report
 * what the provider said, and this decides what that means for the attempt.
 *
 * The attempt is stored before the provider is called, and a retry always
 * resubmits that same attempt — with the same Message-ID — so an outcome we
 * could not see is reconciled rather than sent again as a new message.
 */
class SendAttemptService
{
    public function __construct(private readonly MailTransportFactory $transports) {}

    /**
     * @throws EmailUnavailableException before anything is stored or sent.
     */
    public function send(EmailConnection $connection, Draft $draft, ?User $actor = null): EmailSendAttempt
    {
        $this->guard($connection);

        $draft = $this->withMessageId($draft);

        $attempt = DB::transaction(function () use ($connection, $draft, $actor) {
            $attempt = EmailSendAttempt::withoutGlobalScopes()->create([
                'company_id' => $connection->company_id,
                'connection_id' => $connection->id,
                'created_by' => $actor?->id,
                'draft_payload' => $draft->toArray(),
                'rfc_message_id' => $draft->rfcMessageId,
                'status' => SendAttemptStatus::Sending,
            ]);

            $this->storeRecipients($attempt, $draft);

            return $attempt;
        });

        return $this->submit($attempt, $connection, [SendAttemptStatus::Sending]);
    }

    /**
     * Resubmit the same attempt. A sent attempt, or one already in flight,
     * is returned untouched.
     *
     * @throws EmailUnavailableException before the provider is called; the attempt keeps its state.
     */
    public function retry(EmailSendAttempt $attempt): EmailSendAttempt
    {
        if (! $attempt->status->isRetryable()) {
            return $attempt;
        }

        $connection = $attempt->connection;
        $this->guard($connection);

        return $this->submit($attempt, $connection, [
            SendAttemptStatus::Failed,
            SendAttemptStatus::Checking,
            SendAttemptStatus::WaitingQuota,
        ]);
    }

    /**
     * @param  list<SendAttemptStatus>  $from  States this submission may start from.
     */
    private function submit(EmailSendAttempt $attempt, EmailConnection $connection, array $from): EmailSendAttempt
    {
        // Claim the attempt under a row lock so two workers cannot both submit it.
        $claimed = DB::transaction(function () use ($attempt, $from) {
            $locked = EmailSendAttempt::withoutGlobalScopes()->lockForUpdate()->find($attempt->id);

            if ($locked === null || ! in_array($locked->status, $from, true)) {
                return null;
            }

            // A fresh attempt is already "sending"; only one that has never been tried may be claimed in that state.
            if ($locked->status === SendAttemptStatus::Sending && $locked->attempt_count > 0) {
                return null;
            }

            $locked->status = SendAttemptStatus::Sending;
            $locked->attempt_count++;
            $locked->last_attempted_at = now();
            $locked->next_attempt_at = null;
            $locked->save();

            return $locked;
        });

        if ($claimed === null) {
            return $attempt->refresh();
        }

        return $this->apply($claimed, $this->callProvider($claimed, $connection));
    }

    private function callProvider(EmailSendAttempt $attempt, EmailConnection $connection): SendResult
    {
        try {
            $context = $connection->toContext();
            $transport = $this->transports->forConnection($context);
        } catch (MailTransportException $exception) {
            // Nothing was submitted: there is no adapter to submit it to.
            return SendResult::rejected($exception->errorCode);
        }

        try {
            return $transport->send($context, $attempt->draft());
        } catch (Throwable) {
            // The provider may or may not have taken it.
            return SendResult::unknown('transport_error');
        }
    }

    private function apply(EmailSendAttempt $attempt, SendResult $result): EmailSendAttempt
    {
        return DB::transaction(function () use ($attempt, $result) {
            $attempt->error_code = $result->errorCode;

            if ($result->providerSubmissionId !== null) {
                $attempt->provider_submission_id = $result->providerSubmissionId;
            }

            switch ($result->status) {
                case SendStatus::Accepted:
                    $attempt->status = SendAttemptStatus::Sent;
                    $attempt->sent_at = now();
                    $attempt->error_code = null;

                    EmailSendRecipient::withoutGlobalScopes()
                        ->where('send_attempt_id', $attempt->id)
                        ->where('status', SendRecipientStatus::Pending)
                        ->update(['status' => SendRecipientStatus::Accepted]);
                    break;

                case SendStatus::Rejected:
                    $attempt->status = SendAttemptStatus::Failed;
                    break;

                case SendStatus::Throttled:
                    $attempt->status = SendAttemptStatus::WaitingQuota;
                    $attempt->next_attempt_at = $result->retryAfterSeconds !== null
                        ? now()->addSeconds($result->retryAfterSeconds)
                        : null;
                    break;

                case SendStatus::Unknown:
                    $attempt->status = SendAttemptStatus::Checking;
                    break;
            }

            $attempt->save();

            return $attempt;
        });
    }

    /** Fail closed: flag, pilot allowlist and an active mailbox are all required. */
    private function guard(?EmailConnection $connection): void
    {
        if ($connection === null) {
            throw new EmailUnavailableException('connection_missing');
        }

        if (! EmailFeature::enabledFor($connection->user)) {
            throw new EmailUnavailableException('feature_disabled');
        }

        if (! $connection->isSyncable()) {
            throw new EmailUnavailableException('connection_inactive');
        }
    }

    /** The CRM names the message up front so every retry is recognisably the same one. */
    private function withMessageId(Draft $draft): Draft
    {
        if ($draft->rfcMessageId !== null) {
            return $draft;
        }

        return Draft::fromArray(['rfc_message_id' => '<'.Str::uuid().'@'.$draft->from->domain().'>'] + $draft->toArray());
    }

    private function storeRecipients(EmailSendAttempt $attempt, Draft $draft): void
    {
        $seen = [];

        foreach ([[SendRecipientKind::To, $draft->to], [SendRecipientKind::Cc, $draft->cc]] as [$kind, $addresses]) {
            /** @var EmailAddress $address */
            foreach ($addresses as $address) {
                if (isset($seen[$address->address])) {
                    continue;
                }

                $seen[$address->address] = true;

                EmailSendRecipient::withoutGlobalScopes()->create([
                    'company_id' => $attempt->company_id,
                    'send_attempt_id' => $attempt->id,
                    'address' => $address->address,
                    'name' => $address->name,
                    'kind' => $kind,
                ]);
            }
        }
    }
}
