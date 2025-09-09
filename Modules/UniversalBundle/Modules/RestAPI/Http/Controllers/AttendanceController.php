<?php

namespace Modules\RestAPI\Http\Controllers;

use App\Helper\Reply;
use App\Models\AttendanceSetting;
use App\Models\Company;
use App\Models\Holiday;
use Carbon\Carbon;
use Froiden\RestAPI\ApiResponse;
use Froiden\RestAPI\Exceptions\ApiException;
use Froiden\RestAPI\Exceptions\UnauthorizedException;
use Illuminate\Support\Facades\DB;
use Modules\RestAPI\Entities\Attendance;
use Modules\RestAPI\Http\Requests\Attendance\CreateRequest;
use Modules\RestAPI\Http\Requests\Attendance\DeleteRequest;
use Modules\RestAPI\Http\Requests\Attendance\IndexRequest;
use Modules\RestAPI\Http\Requests\Attendance\ShowRequest;
use Modules\RestAPI\Http\Requests\Attendance\UpdateRequest;

class AttendanceController extends ApiBaseController
{

    protected $model = Attendance::class;

    protected $indexRequest = IndexRequest::class;

    protected $storeRequest = CreateRequest::class;

    protected $updateRequest = UpdateRequest::class;

    protected $showRequest = ShowRequest::class;

    protected $deleteRequest = DeleteRequest::class;

    protected function modifyIndex($query)
    {
        return $query->groupBy('attendances.user_id')->visibility();
    }

    /**
     * @throws UnauthorizedException
     * @throws ApiException
     */
    public function today()
    {
        // Getting Attendance setting data
        $attendanceSettings = AttendanceSetting::first();
        $this->global = Company::first();

        // Getting Current Clock-in if exist
        $attendance = Attendance::where(
            DB::raw('DATE(clock_in_time)'),
            Carbon::today()->format('Y-m-d')
        )
            ->where('user_id', api_user()->id)
            //            ->whereNull('clock_out_time')
            ->first();

        // Getting Today's Total Check-ins
        $todayTotalClockin = Attendance::where(DB::raw('DATE(clock_in_time)'), Carbon::today()->format('Y-m-d'))
            ->where('user_id', api_user()->id)
            ->where(DB::raw('DATE(clock_out_time)'), today()->format('Y-m-d'))
            ->count();

        // Getting Maximum Check-ins in a day
        $maxAttendanceInDay = $attendanceSettings->clockin_in_day;

        // Check Holiday by date
        $checkTodayHoliday = Holiday::where('date', now()->format('Y-m-d'))->first();

        if ($checkTodayHoliday) {
            throw new ApiException('Today is holiday', null, 422, 422, 2001);
        } elseif ($todayTotalClockin > $maxAttendanceInDay) {
            //            throw new ApiException('Maximum check-ins reached', null, 422, 422, 2000);
        }

        $result['attendance'] = $attendance;
        $result['office_hours_passed'] = false;
        $result['time'] = now()->format('c');
        $result['ip_address'] = $_SERVER['REMOTE_ADDR'];
        $result['remaining_clock_in'] = $maxAttendanceInDay - $todayTotalClockin;

        return ApiResponse::make(null, $result);
    }

    public function clockIn()
    {
        $now = now();

        $this->user = api_user();
        $this->global = api_user()->company;
        $attendanceSettings = api_user()->company->attendanceSetting;
        $clockInCount = \App\Models\Attendance::getTotalUserClockIn($now->format('Y-m-d'), $this->user->id);

        // Check user by ip
        if ($attendanceSettings->ip_check == 'yes') {
            $ips = (array)json_decode($attendanceSettings->ip_address);

            if (!in_array(request()->ip(), $ips)) {
                return Reply::error(__('messages.notAnAuthorisedDevice'));
            }
        }

        // Check user by location
        if ($attendanceSettings->radius_check == 'yes') {
            $checkRadius = $this->isWithinRadius(request());

            if (!$checkRadius) {
                return Reply::error(__('messages.notAnValidLocation'));
            }
        }

        // Check maximum attendance in a day
        if ($clockInCount < $attendanceSettings->clockin_in_day) {
            // Set TimeZone And Convert into timestamp
            $currentTimestamp = $now->setTimezone('UTC');
            $currentTimestamp = $currentTimestamp->timestamp;
            $halfDayTimestamp = null;

            // Set TimeZone And Convert into timestamp in half daytime
            if ($attendanceSettings->halfday_mark_time) {
                $halfDayTimestamp = $now->format('Y-m-d') . ' ' . $attendanceSettings->halfday_mark_time;
                $halfDayTimestamp = Carbon::createFromFormat('Y-m-d H:i:s', $halfDayTimestamp, $this->global->timezone);
                $halfDayTimestamp = $halfDayTimestamp->setTimezone('UTC');
                $halfDayTimestamp = $halfDayTimestamp->timestamp;
            }

            $timestamp = $now->format('Y-m-d') . ' ' . $attendanceSettings->office_start_time;
            $officeStartTime = Carbon::createFromFormat('Y-m-d H:i:s', $timestamp, $this->global->timezone);
            $officeStartTime = $officeStartTime->setTimezone('UTC');

            $lateTime = $officeStartTime->addMinutes($attendanceSettings->late_mark_duration);

            $checkTodayAttendance = Attendance::where('user_id', $this->user->id)
                ->where(DB::raw('DATE(attendances.clock_in_time)'), '=', $now->format('Y-m-d'))->first();

            $attendance = new Attendance();
            $attendance->user_id = $this->user->id;
            $attendance->clock_in_time = $now;
            $attendance->clock_in_ip = request()->ip();

            if (is_null(request()->working_from)) {
                $attendance->working_from = 'office';
                $attendance->work_from_type = 'office';
            } else {
                $attendance->working_from = request()->working_from;
                $attendance->work_from_type = request()->work_from_type;
            }

            if ($now->gt($lateTime) && is_null($checkTodayAttendance)) {
                $attendance->late = 'yes';
            }

            $attendance->half_day = 'no'; // default half day

            // Check day's first record and half day time
            if (
                !is_null($attendanceSettings->halfday_mark_time)
                && is_null($checkTodayAttendance)
                && $currentTimestamp > $halfDayTimestamp
            ) {
                $attendance->half_day = 'yes';
            }

            $attendance->save();

            return ApiResponse::make('Clocked in successfully', [
                'time' => $attendance->clock_in_time,
            ]);
        } else {

            $exception = new ApiException('Maximum check-ins reached', null, 403, 403, 2000);

            return ApiResponse::exception($exception);
        }
    }

    public function clockOut($id)
    {
        $now = now();
        $this->user = api_user();
        $attendanceSettings = AttendanceSetting::first();
        $attendance = Attendance::findOrFail($id);

        // Check user by ip
        if ($attendanceSettings->ip_check == 'yes') {
            $ips = (array)json_decode($attendanceSettings->ip_address);

            if (!in_array(request()->ip(), $ips)) {
                return Reply::error(__('messages.notAnAuthorisedDevice'));
            }
        }

        // Check user by location
        if ($attendanceSettings->radius_check == 'yes') {
            $checkRadius = $this->isWithinRadius(request());

            if (!$checkRadius) {
                return Reply::error(__('messages.notAnValidLocation'));
            }
        }

        $attendance->clock_out_time = $now;
        $attendance->clock_out_ip = request()->ip();
        $attendance->save();

        return ApiResponse::make('Clocked out successfully', [
            'time' => $attendance->clock_out_time,
            'clock_out_ip' => request()->ip(),
        ]);
    }

    private function isWithinRadius($request)
    {
        $this->global = Company::first();
        $attendanceSettings = AttendanceSetting::first();
        $radius = $attendanceSettings->radius;
        $currentLatitude = request()->currentLatitude;
        $currentLongitude = request()->currentLongitude;

        $latFrom = deg2rad($this->global->latitude);
        $latTo = deg2rad($currentLatitude);

        $lonFrom = deg2rad($this->global->longitude);
        $lonTo = deg2rad($currentLongitude);

        $theta = $lonFrom - $lonTo;

        $dist = sin($latFrom) * sin($latTo) + cos($latFrom) * cos($latTo) * cos($theta);
        $dist = acos($dist);
        $dist = rad2deg($dist);
        $distance = $dist * 60 * 1.1515 * 1609.344;

        return $distance <= $radius;
    }
}
