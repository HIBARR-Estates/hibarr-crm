<?php

namespace Modules\Recruit\Database\Seeders;

use App\Models\CompanyAddress;
use App\Models\Currency;
use App\Models\EmployeeDetails;
use App\Models\Team;
use App\Models\User;
use Faker\Factory;
use Illuminate\Database\Seeder;
use Modules\Recruit\Entities\JobInterviewStage;
use Modules\Recruit\Entities\Recruiter;
use Modules\Recruit\Entities\RecruitInterviewStage;
use Modules\Recruit\Entities\RecruitJob;
use Modules\Recruit\Entities\RecruitJobAddress;
use Modules\Recruit\Entities\RecruitJobCategory;
use Modules\Recruit\Entities\RecruitJobSkill;
use Modules\Recruit\Entities\RecruitJobSubCategory;
use Modules\Recruit\Entities\RecruitJobType;
use Modules\Recruit\Entities\RecruitSkill;
use Modules\Recruit\Entities\RecruitWorkExperience;

class JobsTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run($companyId)
    {
        $faker = Factory::create();
        $user = User::where('company_id', $companyId)->pluck('id');
        $emp = EmployeeDetails::where('company_id', $companyId)->pluck('user_id');
        $skills = RecruitSkill::where('company_id', $companyId)->pluck('id');
        $addressID = CompanyAddress::where('company_id', $companyId)->pluck('id');

        $recruiters = new Recruiter;
        $recruiters->company_id = $companyId;
        $recruiters->user_id = $emp->random();
        $recruiters->added_by = $emp->random();
        $recruiters->save();

        $jobCategory = new RecruitJobCategory;
        $jobCategory->company_id = $companyId;
        $jobCategory->category_name = 'Developer';
        $jobCategory->save();

        $jobSubCategory = new RecruitJobSubCategory;
        $jobSubCategory->company_id = $companyId;
        $jobSubCategory->recruit_job_category_id = $jobCategory->id;
        $jobSubCategory->sub_category_name = 'Laravel Developer';
        $jobSubCategory->save();

        $department = Team::where('company_id', $companyId)->pluck('id');

        $recruiters = Recruiter::with('user')
            ->where('company_id', $companyId)
            ->pluck('user_id');

        $experience = RecruitWorkExperience::where('company_id', $companyId)->pluck('id');
        $jobType = RecruitJobType::where('company_id', $companyId)->pluck('id');
        $stages = RecruitInterviewStage::where('company_id', $companyId)->pluck('id');
        $currencyID = Currency::where('company_id', $companyId)->pluck('id');

        $jobs = [
            [
                'title' => 'Software Developer',
                'slug' => 'software-developer',
                'total_positions' => 12,
                'department_id' => $department->random(),
                'recruiter_id' => $recruiters->random(),
                'job_type' => 'part time',
                'recruit_work_experience_id' => $experience->random(),
                'recruit_job_category_id' => $jobCategory->id,
                'recruit_job_sub_category_id' => $jobSubCategory->id,
                'currency_id' => $currencyID->random(),
                'pay_type' => 'Range',
                'start_amount' => 645,
                'end_amount' => 4500,
                'pay_according' => 'day',
                'start_date' => now()->format('Y-m-d H:i:s'),
                'end_date' => now()->addDays('20')->format('Y-m-d H:i:s'),
                'status' => 'open',
                'disclose_salary' => 'yes',
                'is_photo_require' => 0,
                'is_resume_require' => 0,
                'is_dob_require' => 0,
                'is_gender_require' => 0,
                'recruit_job_type_id' => $jobType->random(),
                'job_description' => $faker->text(),
                'remaining_openings' => 12,
                'added_by' => $user->random(),
            ],
            [
                'title' => 'Software Tester',
                'slug' => 'software-tester',
                'total_positions' => 41,
                'department_id' => $department->random(),
                'recruiter_id' => $recruiters->random(),
                'job_type' => 'part time',
                'recruit_work_experience_id' => $experience->random(),
                'recruit_job_category_id' => $jobCategory->id,
                'recruit_job_sub_category_id' => $jobSubCategory->id,
                'currency_id' => $currencyID->random(),
                'pay_type' => 'Range',
                'start_amount' => 245,
                'end_amount' => 452,
                'pay_according' => 'day',
                'start_date' => now()->format('Y-m-d H:i:s'),
                'end_date' => now()->addDays('10')->format('Y-m-d H:i:s'),
                'status' => 'open',
                'is_photo_require' => 0,
                'is_resume_require' => 0,
                'is_dob_require' => 0,
                'is_gender_require' => 0,
                'recruit_job_type_id' => $jobType->random(),
                'job_description' => $faker->text(),
                'remaining_openings' => 41,
                'added_by' => $user->random(),
            ],
            [
                'title' => 'Designer',
                'slug' => 'designer',
                'total_positions' => 52,
                'department_id' => $department->random(),
                'recruiter_id' => $recruiters->random(),
                'job_type' => 'part time',
                'recruit_work_experience_id' => $experience->random(),
                'recruit_job_category_id' => $jobCategory->id,
                'recruit_job_sub_category_id' => $jobSubCategory->id,
                'currency_id' => $currencyID->random(),
                'pay_type' => 'Range',
                'start_amount' => 95,
                'end_amount' => 150,
                'pay_according' => 'day',
                'start_date' => now()->format('Y-m-d H:i:s'),
                'end_date' => now()->addDays('10')->format('Y-m-d H:i:s'),
                'status' => 'open',
                'is_photo_require' => 0,
                'is_resume_require' => 0,
                'is_dob_require' => 0,
                'is_gender_require' => 0,
                'recruit_job_type_id' => $jobType->random(),
                'job_description' => $faker->text(),
                'remaining_openings' => 52,
                'added_by' => $user->random(),
            ],
            [
                'title' => 'UI/UX developer',
                'slug' => 'ui-developer',
                'total_positions' => 32,
                'department_id' => $department->random(),
                'recruiter_id' => $recruiters->random(),
                'job_type' => 'part time',
                'recruit_work_experience_id' => $experience->random(),
                'recruit_job_category_id' => $jobCategory->id,
                'recruit_job_sub_category_id' => $jobSubCategory->id,
                'currency_id' => $currencyID->random(),
                'pay_type' => 'Range',
                'start_amount' => 155,
                'end_amount' => 250,
                'pay_according' => 'day',
                'start_date' => now()->format('Y-m-d H:i:s'),
                'end_date' => null,
                'status' => 'open',
                'disclose_salary' => 'yes',
                'is_photo_require' => 0,
                'is_resume_require' => 0,
                'is_dob_require' => 0,
                'is_gender_require' => 0,
                'recruit_job_type_id' => $jobType->random(),
                'job_description' => $faker->text(),
                'remaining_openings' => 32,
                'added_by' => $user->random(),
            ],
        ];

        foreach ($jobs as $job) {
            $job['company_id'] = $companyId;
            $data = RecruitJob::create($job);

            $skill = new RecruitJobSkill;
            $skill->recruit_job_id = $data->id;
            $skill->recruit_skill_id = $skills->random();
            $skill->save();

            $address = new RecruitJobAddress;
            $address->recruit_job_id = $data->id;
            $address->company_address_id = $addressID->random();
            $address->save();

            $stage = new JobInterviewStage;
            $stage->recruit_job_id = $data->id;
            $stage->recruit_interview_stage_id = $stages->random();
            $stage->save();
        }
    }
}
