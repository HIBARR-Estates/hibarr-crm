<?php

namespace App\Email\Models;

use App\Email\Data\Checkpoint;
use App\Email\Data\ConnectionContext;
use App\Email\Data\EmailAddress;
use App\Email\Enums\ConnectionStatus;
use App\Models\BaseModel;
use App\Models\User;
use App\Traits\HasCompany;
use Database\Factories\Email\EmailConnectionFactory;
use DomainException;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One user's mailbox at one provider. The uuid is the CRM identity handed to
 * adapters and the outside world; provider ids never stand in for it.
 *
 * @property int $id
 * @property string $uuid
 * @property int $company_id
 * @property int $user_id
 * @property string $provider
 * @property string $identity_email
 * @property string $from_email
 * @property string|null $reply_to_email
 * @property array<string, mixed>|null $credentials
 * @property ConnectionStatus $status
 * @property \Illuminate\Support\Carbon|null $sync_stopped_at
 * @property array<string, string>|null $checkpoint
 * @property \Illuminate\Support\Carbon|null $last_sync_at
 * @property string|null $last_error_code
 */
class EmailConnection extends BaseModel
{
    use HasCompany;
    use HasFactory;
    use HasUuids;

    protected $table = 'email_connections';

    protected $fillable = [
        'company_id',
        'user_id',
        'provider',
        'identity_email',
        'from_email',
        'reply_to_email',
        'credentials',
        'status',
        'sync_stopped_at',
        'checkpoint',
        'last_sync_at',
        'last_error_code',
    ];

    protected $casts = [
        'credentials' => 'encrypted:array',
        'status' => ConnectionStatus::class,
        'sync_stopped_at' => 'datetime',
        'checkpoint' => 'array',
        'last_sync_at' => 'datetime',
    ];

    /** Secrets never leave the server in a serialized model. */
    protected $hidden = [
        'credentials',
    ];

    protected $attributes = [
        'status' => 'active',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saving(function (EmailConnection $connection) {
            $ownerCompanyId = User::withoutGlobalScopes()->whereKey($connection->user_id)->value('company_id');

            $connection->company_id ??= $ownerCompanyId;

            // A mailbox belongs to its owner's company, never to another one.
            if ($ownerCompanyId === null || (int) $ownerCompanyId !== (int) $connection->company_id) {
                throw new DomainException('Email connection owner must belong to the connection company.');
            }

            $connection->identity_email = strtolower(trim((string) $connection->identity_email));
            $connection->from_email = strtolower(trim((string) $connection->from_email));
            $connection->reply_to_email = $connection->reply_to_email !== null
                ? strtolower(trim($connection->reply_to_email))
                : null;
        });
    }

    protected static function newFactory(): EmailConnectionFactory
    {
        return EmailConnectionFactory::new();
    }

    /**
     * @return list<string>
     */
    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withoutGlobalScopes();
    }

    public function isSyncable(): bool
    {
        return $this->status === ConnectionStatus::Active;
    }

    /** The plain snapshot adapters work from. */
    public function toContext(): ConnectionContext
    {
        return new ConnectionContext(
            key: $this->uuid,
            provider: $this->provider,
            identity: new EmailAddress($this->identity_email),
            from: new EmailAddress($this->from_email),
            replyTo: $this->reply_to_email !== null ? new EmailAddress($this->reply_to_email) : null,
            credentials: $this->credentials ?? [],
        );
    }

    public function syncCheckpoint(): Checkpoint
    {
        return Checkpoint::fromArray($this->checkpoint);
    }
}
