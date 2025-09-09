<?php

namespace Modules\RestAPI\Http\Controllers;

use Modules\RestAPI\Entities\User;
use Froiden\RestAPI\ApiResponse;
use Froiden\RestAPI\Exceptions\ApiException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;
use Illuminate\Support\Str;
use Modules\RestAPI\Http\Requests\Auth\EmailVerifyRequest;
use Modules\RestAPI\Http\Requests\Auth\LoginRequest;
use Modules\RestAPI\Http\Requests\Auth\RefreshTokenRequest;

class AuthController extends ApiBaseController
{

    public function login(LoginRequest $request)
    {
        // Modifications to this function may also require modifications to
        $email = $request->get('email');
        $password = $request->get('password');
        $days = 365;
        $minutes = 60 * 60 * $days;
        $claims = ['exp' => (int)now()->addYear()->getTimestamp(), 'remember' => 1, 'type' => 1];

        $check = auth()->attempt(['email' => $email, 'password' => $password]);

        if ($check) {
            $user = User::where('email', $email)->first();

            if ($user && $user->status === 'deactive') {
                auth()->logout();
                $exception = new ApiException('User account disabled', null, 403, 403, 2015);

                return ApiResponse::exception($exception);
            }


            $user = auth()->user();
            $expiry = now()->addYear();
            $tokenName = Str::slug($user->name . ' ' . $user->id);

            $token = $user->createToken($tokenName, ['*'], $expiry, $claims)->plainTextToken;


            return ApiResponse::make('Logged in successfully', [
                'token' => $token,
                'user' => $user->load('roles', 'roles.perms', 'roles.permissions'),
                'expires' => $expiry->format('Y-m-d\TH:i:sP'),
                'expires_in' => $minutes,
            ]);
        }

        $exception = new ApiException('Wrong credentials provided', null, 403, 403, 2001);

        return ApiResponse::exception($exception);
    }

    public function logout(Request $request)
    {
        $user = auth()->user();
        $user->currentAccessToken()->delete();

        return ApiResponse::make('Token invalidated successfully');
    }

    public function refresh(RefreshTokenRequest $request)
    {
        $user = auth()->user();

        if ($user->status === 'inactive') {
            $this->logout();
            throw new ApiException('User account disabled', null, 403, 403, 2015);
        }

        $expiry = now()->addHour();
        $claims = $user->currentAccessToken()->claims;

        $currentToken = $user->currentAccessToken()->id;
        $tokenName = Str::slug($user->name . ' ' . $user->id);

        $newToken = $user->createToken($tokenName, ['*'], now()->addHour(), $claims)->plainTextToken;

        // Revoke Old Token
        $user->tokens()->where('id', $currentToken)->delete();

        return ApiResponse::make('Token refreshed successfully', [
            'token' => $newToken,
            'expires' => $expiry->format('Y-m-d\TH:i:sP'),
            'expires_in' =>  60, // 60 minutes
        ]);
    }

    public function verify(EmailVerifyRequest $request)
    {

        $user = Employee::where('email_verification_token', $request->token)
            ->whereNotNull('email_verification_token')
            ->first();

        if ($user) {
            DB::beginTransaction();

            $user->email_verification_token = null;
            $user->email_verified = 'yes';
            $user->save();

            $user->company->company_email_verified = 'yes';
            $user->company->save();

            event(new EmailVerificationSuccessEvent($user->company, $user));
            DB::commit();

            return ApiResponse::make('Success', ['status' => 'success']);
        }

        return ApiResponse::make('Token is expired', ['status' => 'fail']);
    }


    public function me(): \Illuminate\Http\Response
    {
        return ApiResponse::make('Auth User', [
            'data' => auth()->user()->load('roles', 'roles.perms', 'roles.permissions'),
        ]);
    }
}
