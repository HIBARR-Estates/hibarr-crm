<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A booking made through a Calendly link, remembered so a retried delivery
 * does not create a second meeting and a cancellation finds its meeting.
 *
 * @property int $id
 * @property int $company_id
 * @property int|null $calendly_meeting_link_id
 * @property string $invitee_uri
 * @property string|null $event_uri
 * @property int|null $follow_up_id
 * @property string $status
 */
class CalendlyBooking extends Model
{
    public const STATUS_BOOKED = 'booked';

    public const STATUS_CANCELED = 'canceled';

    protected $guarded = [];
}
