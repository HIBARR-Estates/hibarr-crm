<?php

namespace Modules\Recruit\Http\Requests\JobApplication;

use App\Http\Requests\CoreRequest;
use Modules\Recruit\Entities\RecruitJob;
use Modules\Recruit\Rules\CheckApplication;

class UpdateJobApplication extends CoreRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return bool
     */
    public function rules()
    {
        $setting = company();

        if (request()->job_id) {
            $jobId = RecruitJob::where('id', request()->job_id)->first();

            $data = ['job_id' => 'required',
                'full_name' => 'required',
                'phone' => 'required',
                'location_id' => 'required', ];

            if (! is_null(request()->email) && request()->application_id != request()->id) {
                $data['email'] = [new CheckApplication];
            }

            if ($jobId->is_gender_require) {
                $data['gender'] = 'required';
            }

            if ($jobId->is_dob_require) {
                $data['date_of_birth'] = 'required|date_format:"'.$setting->date_format.'"|before_or_equal:'.now($setting->timezone)->toDateString();
            }

            if ($jobId->is_photo_require) {
                $data['photo'] = 'required';
            }

            if ($jobId->is_resume_require) {
                $data['resume'] = 'required';
            }
        } else {
            $data = ['job_id' => 'required',
                'full_name' => 'required',
                'phone' => 'required',
                'location_id' => 'required', ];
        }

        return $data;
    }

    public function authorize()
    {
        return true;
    }

    public function messages()
    {
        return [
            //
        ];
    }
}
