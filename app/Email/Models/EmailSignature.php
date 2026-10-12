<?php

namespace App\Email\Models;

use App\Models\BaseModel;
use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * CRM-authored signature for one mailbox connection. Shown once in the
 * composer preview and appended once at send time — never duplicated into
 * the editable body field.
 *
 * @property int $id
 * @property int $company_id
 * @property int $connection_id
 * @property string|null $text_body
 * @property string|null $html_body
 */
class EmailSignature extends BaseModel
{
    use HasCompany;

    protected $table = 'email_signatures';

    protected $fillable = [
        'company_id',
        'connection_id',
        'text_body',
        'html_body',
    ];

    public function connection(): BelongsTo
    {
        return $this->belongsTo(EmailConnection::class, 'connection_id')->withoutGlobalScopes();
    }

    public function hasContent(): bool
    {
        return trim((string) $this->text_body) !== ''
            || trim(strip_tags((string) $this->html_body)) !== '';
    }

    /**
     * @return array{text: string|null, html: string|null, has_content: bool}
     */
    public function present(): array
    {
        return [
            'text' => $this->text_body,
            'html' => $this->html_body,
            'has_content' => $this->hasContent(),
        ];
    }
}
