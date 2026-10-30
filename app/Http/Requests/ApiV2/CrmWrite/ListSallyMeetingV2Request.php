<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

class ListSallyMeetingV2Request extends ListCrmWriteV2Request
{
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'meeting_id' => 'nullable|integer|min:1',
        ]);
    }
}
