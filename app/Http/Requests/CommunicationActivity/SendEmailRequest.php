<?php

namespace App\Http\Requests\CommunicationActivity;

use App\Http\Requests\CoreRequest;

class SendEmailRequest extends CoreRequest
{
    /**
     * Determine if the user is authorized to make this request.
     * 
     * Authorization is based on the user's ability to view/edit deals or leads,
     * since sending emails is a communication action on these entities.
     * If the request specifies a deal_id, we check deal permissions;
     * if it specifies a lead_id, we check lead permissions;
     * if neither is specified, we check if the user has any relevant permission.
     *
     * @return bool
     */
    public function authorize()
    {
        $user = user();
        
        if (!$user) {
            return false;
        }
        
        // Check if user has permission to view/edit deals or leads
        // Sending emails is a communication action, so we require at least view permission
        // The permission() method returns false if no permission, or a string ('all', 'added', 'owned', 'both') if permission exists
        $hasDealPermission = ($user->permission('view_deals') !== false) || 
                            ($user->permission('edit_deals') !== false);
        $hasLeadPermission = ($user->permission('view_leads') !== false) || 
                            ($user->permission('edit_leads') !== false);
        
        // If request specifies a deal_id, require deal permission
        if ($this->has('deal_id') && !empty($this->deal_id)) {
            return $hasDealPermission;
        }
        
        // If request specifies a lead_id, require lead permission
        if ($this->has('lead_id') && !empty($this->lead_id)) {
            return $hasLeadPermission;
        }
        
        // If neither is specified, allow if user has any relevant permission
        return $hasDealPermission || $hasLeadPermission;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array
     */
    public function rules()
    {
        $companyId = company()->id;
        
        return [
            'deal_id' => 'nullable|integer|exists:deals,id,company_id,' . $companyId . '|required_without:lead_id',
            'lead_id' => 'nullable|integer|exists:leads,id,company_id,' . $companyId . '|required_without:deal_id',
            'activity_id' => 'nullable|integer|exists:communication_activities,id,company_id,' . $companyId,
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:65535',
            'template' => 'nullable|string|max:255',
            'template_data' => 'nullable|array',
            'sender_id' => 'nullable|integer|exists:users,id,company_id,' . $companyId,
            'sender_email' => 'nullable|email|exists:users,email,company_id,' . $companyId,
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array
     */
    public function messages()
    {
        return [
            'deal_id.exists' => 'The selected deal does not exist.',
            'lead_id.exists' => 'The selected lead does not exist.',
            'activity_id.exists' => 'The selected communication activity does not exist.',
            'subject.required' => 'Email subject is required.',
            'message.required' => 'Email message is required.',
        ];
    }
}

