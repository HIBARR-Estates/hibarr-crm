<?php

namespace App\Http\Requests\ApiV2\CrmWrite;

use App\Http\Requests\ApiV2\CrmWrite\Concerns\ValidatesCrmWriteTargets;
use App\Http\Requests\CoreRequest;
use Illuminate\Validation\Validator;

class UpsertSallyMeetingV2Request extends CoreRequest
{
    use ValidatesCrmWriteTargets;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->prepareCrmWriteTargetValidation();

        $merge = [];
        $payload = $this->input('payload');
        if (is_array($payload)) {
            foreach (['summary', 'transcript', 'transcript_segments', 'bullet_points'] as $field) {
                if (array_key_exists($field, $payload) && ! $this->has($field)) {
                    $merge[$field] = $payload[$field];
                }
            }
        }

        if (! isset($merge['summary']) && ! $this->filled('summary')) {
            $meetingSummary = $this->input('meeting_summary');
            if (is_string($meetingSummary) && trim($meetingSummary) !== '') {
                $merge['summary'] = $meetingSummary;
            } elseif (
                is_array($meetingSummary)
                && isset($meetingSummary['summary'])
                && is_string($meetingSummary['summary'])
            ) {
                $merge['summary'] = $meetingSummary['summary'];
            }
        }

        if ($merge !== []) {
            $this->merge($merge);
        }
    }

    public function rules(): array
    {
        return array_merge($this->crmWriteTargetRules(), [
            'meeting_id' => 'required|integer|min:1',
            'payload' => 'nullable|array',
            'payload.summary' => 'nullable|string',
            'payload.transcript' => 'nullable',
            'payload.transcript_segments' => 'nullable|array',
            'payload.bullet_points' => 'nullable|array',
            'meeting_summary' => 'nullable',
            'summary' => 'nullable|string',
            // Plain string or Sally segment list ({ speakerName, text, startTime, … }).
            'transcript' => 'nullable',
            'transcript_segments' => 'nullable|array',
            'transcript_segments.*.text' => 'required_with:transcript_segments|string',
            'transcript_segments.*.speakerName' => 'nullable|string|max:191',
            'transcript_segments.*.speaker' => 'nullable|string|max:191',
            'transcript_segments.*.id' => 'nullable|string|max:64',
            'transcript_segments.*.startTime' => 'nullable|numeric',
            'transcript_segments.*.endTime' => 'nullable|numeric',
            'transcript_segments.*.sortOrder' => 'nullable|integer',
            'bullet_points' => 'nullable|array',
            'bullet_points.*' => 'string',
        ]);
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $this->validateCrmWriteTargets($validator);

            $transcript = $this->input('transcript');
            $hasTranscript = is_string($transcript)
                ? trim($transcript) !== ''
                : is_array($transcript) && $transcript !== [];

            if (
                ! $this->filled('summary')
                && ! $hasTranscript
                && ! $this->filled('transcript_segments')
                && ! $this->filled('bullet_points')
            ) {
                $message = 'At least one of summary, transcript, transcript_segments, or bullet_points is required.';
                $validator->errors()->add('summary', $message);
            }

            if ($transcript !== null && ! is_string($transcript) && ! is_array($transcript)) {
                $validator->errors()->add('transcript', 'Transcript must be a string or an array of segments.');
            }
        });
    }
}
