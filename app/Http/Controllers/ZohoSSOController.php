<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ZohoSSOController extends Controller
{

    /**
     * Redirect user to Zoho SSO authorization page.
     */
    public function redirectToZoho()
    {

        $scope = 'ZohoAccounts.profile.READ'; // TODO: Confirm scope is the correct value

        $query = http_build_query([
            'client_id' => config('zoho.client_id'),
            'redirect_uri' => config('zoho.redirect_uri'),
            'response_type' => 'code',
            'scope' => $scope,
            'access_type' => 'offline',
            'prompt' => 'consent'
        ]);

        $url = config('zoho.authorize_url') . '?' . $query;

        return redirect($url);
    }

    /**
     * Handle Zoho SSO callback and store Zoho ID.
     */
    public function handleCallback(Request $request)
    {
        $code = $request->input('code');
        if (!$code) {
            return redirect()->route('login')->with('error', 'Zoho SSO failed: No code received.');
        }

        // Exchange code for access token
        $response = Http::asForm()->post(config('zoho.token_url'), [
            'grant_type' => 'authorization_code',
            'client_id' => config('zoho.client_id'),
            'client_secret' => config('zoho.client_secret'),
            'redirect_uri' => config('zoho.redirect_uri'),
            'code' => $code,
        ]);
        if (!$response->ok() || !isset($response['access_token'])) {
            return redirect()->route('login')->withErrors('Zoho SSO failed: Unable to get access token.');
        }

        $accessToken = $response['access_token'];

        // Fetch user profile from Zoho
        $userResponse = Http::withToken($accessToken)
            ->get(config('zoho.userinfo_url'));

        if ($userResponse->failed()) {
            return redirect()->route('login')->withErrors('Failed to fetch Zoho user info.');
        }

        $zohoUser = $userResponse->json();
        $zohoId   = $zohoUser['ZUID'] ?? null; // Zoho unique ID
        $email    = $zohoUser['Email'] ?? null;

        if (!$zohoId || !$email) {
            return redirect()->route('login')->withErrors('Invalid Zoho user data.');
        }

        // Map Zoho user to employee
        $employee = EmployeeDetails::where('zoho_id', $zohoId)
            ->orWhereHas('user', function ($q) use ($email) {
                $q->where('email', $email);
            })
            ->first();

        if (!$employee) {
            return redirect()->route('login')->withErrors('No employee account linked with Zoho.');
        }

        // Save zoho_id if not already
        if (!$employee->zoho_id) {
            $employee->update(['zoho_id' => $zohoId]);
        }

        // Login the linked user
        Auth::login($employee->user);

        return redirect()->route('dashboard')->with('success', 'Zoho SSO linked successfully!');

    }

}
