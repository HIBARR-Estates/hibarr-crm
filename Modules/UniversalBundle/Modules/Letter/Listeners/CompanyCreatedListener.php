<?php

namespace Modules\Letter\Listeners;

use Modules\Letter\Entities\LetterSetting;
use Modules\Letter\Entities\Template;

class CompanyCreatedListener
{

    /**
     * Handle the event.
     *
     * @param  object  $event
     * @return void
     */
    public function handle($event)
    {
        $company = $event->company;
        LetterSetting::addModuleSetting($company);

        $this->addLetters($company);
    }

    public function addLetters($company): void
    {

        $incrementLetter = <<<HOD
<span style="font-size: 12px;"><b>##EMPLOYEE_NAME##</b></span><br>
Employee ID:&nbsp;<span style="font-size: 12px;"><b>##EMPLOYEE_ID##</b></span><br>
Designation:&nbsp;<span style="font-size: 12px;"><b>##EMPLOYEE_DESIGNATION##</b></span><br>
Date: <b><u>XXXX</u></b><br>
<br>
Subject: Salary increment <br>
<br>
Dear&nbsp;<span style="font-size: 12px;">&nbsp;##EMPLOYEE_NAME##</span>,<br>
<br>
Congratulations!<br>
We would like to gladly inform you that your salary will be increased by&nbsp;<b><u>XXXX</u></b> starting <b><u>XXXX</u></b> and your new salary will be <b><u>XXXX</u></b> This increase is the result your continuous contribution to the success of this company. We recognize your efforts and would like to reward you for that. <br>
<br>
We also hope this will encourage you to perform even better. There is always room for improvement. <br>
Keep up the good work. <br>
<br>
<br>
__________________________<br><span style="font-size: 12px;">##SIGNATORY##,<br></span><span style="font-size: 12px;">##SIGNATORY_DESIGNATION##</span>&nbsp;–&nbsp;<span style="font-size: 12px;">##SIGNATORY_DEPARTMENT##</span><br><span style="font-size: 12px;">##COMPANY_NAME##</span><br>


HOD;

        $offerLetter = <<<HOD

<p>       <br>
June 09, 2014<br><br><span style="font-size: 12px;"><b>##EMPLOYEE_NAME##</b></span><br><span style="font-size: 12px;">##EMPLOYEE_ADDRESS##<br></span><br>Dear<b>&nbsp;<span style="font-size: 12px;">##EMPLOYEE_NAME##,</span></b></p><p><br>
Further to our discussions, we are pleased to offer you a position in&nbsp;<span style="font-size: 12px;"><b>##COMPANY_NAME## ,</b>&nbsp;</span><br>
LIMITED.<br><br><b>
Position &amp; Joining:</b><br>
You shall be appointed as&nbsp;<span style="font-size: 12px;">&nbsp;##EMPLOYEE_DESIGNATION##&nbsp;</span>&nbsp;with&nbsp;<span style="font-size: 12px;">##COMPANY_NAME## </span>. You are expected to join<br>
on <b><u>XXXDATEXXX</u></b> at <b>XX<u>TIMEXX</u></b>&nbsp;at the following location to complete your joining formalities:<br><br><span style="font-size: 12px;"><b>##CONTACT_ADDRESS##</b></span><br><br>
Any change in the date of joining would be at the sole discretion of&nbsp;<span style="font-size: 12px;">##COMPANY_NAME##</span>&nbsp;.Please confirm via<br>
e-mail your exact date of joining at least 5 days in advance.<br><br><b>&nbsp;Working Hours:</b><br>
The work timing are at the sole discretion of the Management and would normally consist of a 45 hours’ work week. These are subject to change as per business requirements. Same numbers of work hours are expected even when you are on an assignment abroad, unless communicated otherwise by a ##COMPANY_NAME## entity. The general working hours will be 9:30 A.M. to 6:30 P.M, Monday through Friday, and half day upto 3.00 PM on Saturday with one hour break for lunch. Employees may also be expected to work in shifts based on business requirements.<br><br><b>
Paid Casual Leave:</b><br>
The entitlement is for 10 casual leave in a year. Other terms and conditions will be applicable to you as per the prevailing Leave Policy.</p><p><b><br>
Sick Leave:</b><br>
Employees are provided a total of 5 sick leaves annually to enable proper health attention in case of sickness. These leaves are provided at the beginning of each year and are valid for that year only. They cannot be carried over.</p><p><br><b>
Non-Disclosure:</b><br>
Due to the proprietary nature of our products and services, all employees are expected to maintain the highest level of confidentiality and will be required to sign an agreement not to disclose any information with respect to&nbsp;<span style="font-size: 12px;">##COMPANY_NAME##</span></p><p><b>Business Code of Conduct and Ethics:</b><br>
All employees are expected to maintain the highest level of ethical conduct and are required to sign our Code of Ethical Business Conduct I Conflict of Interest certificate. Any instance of improper conduct including but not limited to misconduct, gross negligence or abandonment of the position to which you have been appointed shall constitute sufficient grounds for immediate termination of your services without any notice or payment in lieu of.</p><p><b>Information Security:</b><br>
All employees are expected to maintain the confidentiality and integrity of the information assets and comply with the Information Security Policies. Employees are expected to maintain confidentiality of information residing in mobile computing devices such as portable laptops, notebooks, palmtops, other transportable computers and storage media. Employees are responsible for maintaining information security outside the premises of organization and outside the normal working hours.<br><b>
</b></p><p><b>Notice for termination:</b><br>
The written notice required for termination of employment will be 1 months’ notice by either party. You would be required to serve the stipulated notice period and early release would be at the sole discretion of the Management. In case you leave your employment without giving requisite notice, no relieving letter will be issued and settlement of dues will be at the sole discretion of the Management. However, under ##COMPANY_NAME## disciplinary procedure your services can be terminated without any notice period.<br><b>
</b></p><p><b>Service Agreement:</b><br>
Post you are joining, should you accept any specialized training whether in India or abroad, you will be required to commit to serve ##COMPANY_NAME## for a minimum period of 12 months as per the ##COMPANY_NAME## policy. You will be required to enter into a Service Agreement, as per ##COMPANY_NAME##’ policy on Training, supported with a Guarantee in the form and manner decided by ##COMPANY_NAME## .You are under no obligation to accept any training requiring a commitment to serve ##COMPANY_NAME## on your part .However, once accepted by you, it will be a binding contract.<br><b>
</b></p><p><b>Non-Smoking Policy:</b><br>
Smoking is prohibited in the office premises other than the specifically assigned zones, if any.<br>
<br><b>
Salary Details:</b><br>
You will be given <b><u>XXXSALARYXXX</u></b> per month as a salary .</p><p><br><b>
Joining Requirements:</b><br>
You are required to contact HR department on the date you report for work as per terms of this letter at 9:30 A.M.<br>
You are required to submit a copy of the following documents for joining:<br>
1. Photocopies of all educational certificates (Class X onwards)<br>
2. Mark sheets I Consolidated mark sheets of all educational qualifications (Class X onwards) Three recent passport size photographs<br>
3. Completed service agreement I guarantor's agreement if applicable to you<br>
4. All relevant pages of your Passport, Driving License and PAN card<br>
5. Last month Pay-slip of your last organization I Form 16 of the last financial year I Last month bank statement depicting salary credit from your last organization<br>
6. Please bring originals of all documents which will be returned to you after verification except service agreement which will be retained by ##COMPANY_NAME## (if applicable).<br>
This offer/appointment is subject to the condition that you indemnify and also certify that all the information (like educational qualifications, work experience, past salary drawn and all other information) supplied by you to ##COMPANY_NAME## to get an employment with ##COMPANY_NAME##, is accurate and nothing has been given untrue. If it is later found that you had supplied inaccurate/untrue/false information, then ##COMPANY_NAME## reserves the right to terminate your services without any notice and seek appropriate damages or reimbursement of financial expenses incurred towards your training, relocation, any other allowances, etc. This is without prejudice to any other rights which ##COMPANY_NAME## may have against you.</p><p><br>
##COMPANY_NAME## reserves the right to change terms and the conditions of your employment and its policies and procedures at any time.<br>
Please sign a duplicate copy of this letter confirming your acceptance of the above terms and conditions of appointment and return it to us for office records.<br>
We are excited about your decision to join the company and wish you a long successful career with ##COMPANY_NAME##.<br>
</p><p>Sincerely,<br><span style="font-size: 12px;">##SIGNATORY##&nbsp;</span><br><span style="font-size: 12px;">##SIGNATORY_DESIGNATION##&nbsp; -&nbsp; ##SIGNATORY_DEPARTMENT##</span><br><br></p><p><br><div style="text-align: center;"><b>Read and Accepted</b></div>
<br>
Dear&nbsp;<span style="font-size: 12px;">##EMPLOYEE_NAME##</span>,<br>
Annexure<br>
Please note that you must submit a copy of your Permanent Account Number (PAN) card on your date of joining at ##COMPANY_NAME##. By acknowledging this document, you undertake that you shall be solely responsible for any consequences arising due to non-submission of your PAN copy and ##COMPANY_NAME## shall not be responsible for the same, in any manner whatsoever.<br><br>
Date:<br><span style="font-size: 12px;">##EMPLOYEE_NAME##</span><br>Read and accepted</p>
HOD;


        $joiningLetter = <<<HOD

                                       <p>                                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<br><div style="text-align: center;">&nbsp;<b>Joining Letter</b></div>
<br>
<br><span style="font-size: 12px;"><b>##EMPLOYEE_NAME##</b></span><br><span style="font-size: 12px;"><b>##EMPLOYEE_ADDRESS##</b></span><br>
<br>
Date:&nbsp;<span style="font-size: 12px;"><b>##EMPLOYEE_JOINING_DATE##</b></span><br>
<br>
Dear&nbsp;<b style="font-size: 12px;">##EMPLOYEE_NAME##</b>,<br>
<br>
Thank you for joining ABC Pvt. Ltd. on<b>&nbsp;<span style="font-size: 12px;">##EMPLOYEE_JOINING_DATE##</span>&nbsp;</b>and accepting the position of<b>&nbsp;<span style="font-size: 12px;">##EMPLOYEE_DESIGNATION##</span></b>. We are pleased to have you on our team. This letter acknowledges that you have completed all the formalities for joining ##COMPANY_NAME## and have accepted the terms of job as described below:<br>
<br>
Monthly Compensation: XXXX INR<br><br>
You are expected to abide by the Company’s policies, ethics and principles during your employment. Looking forward to a healthy and productive employment relationship with you.<br>
<br>
<br>
<br>
_____________________________<br><span style="font-size: 12px;">##SIGNATORY##</span><br><span style="font-size: 12px;">##SIGNATORY_DESIGNATION##</span>&nbsp;–&nbsp;<span style="font-size: 12px;">##SIGNATORY_DEPARTMENT##</span><br><span style="font-size: 12px;">##COMPANY_NAME##</span><br>
</p>

HOD;

        $acceptanceLetter = <<<HOD
<p><br></p><p><div style="text-align: center;"><b>Acceptance Letter</b></div>
<br>
<br><span style="font-size: 12px;">##EMPLOYEE_JOINING_DATE##</span><br><span style="font-size: 12px;">##SIGNATORY_DESIGNATION##</span>,<br><span style="font-size: 12px;">##SIGNATORY_DESIGNATION## , ##SIGNATORY_DEPARTMENT##</span>,<br><br><span style="font-size: 12px;">##COMPANY_NAME##,</span><br><span style="font-size: 12px;">##CONTACT_ADDRESS##</span><br>
<br>
Subject: Acceptance Letter<br>
<br>
Dear&nbsp;<span style="font-size: 12px;">##SIGNATORY## </span>,<br>
<br>
I am pleased to accept your offer and I would like to inform you that I am joining the company from&nbsp;<span style="font-size: 12px;">##EMPLOYEE_JOINING_DATE##</span>&nbsp;as a<span style="font-size: 12px;">##EMPLOYEE_DESIGNATION## i</span>n respect to your appointment letter dated XXOFFERLETTERDATEXXX As we discussed, my starting salary will be 9,000 per month. I understand and accept the conditions of employment that you explained in your appointment letter.<br>
<br>
The position is ideally suited to my educational background and interests. I confidently feel that I can make a significant contribution to your company, and I am grateful for the opportunity you have given me. I humbly request you to accept my acceptance letter.<br>
<br>
Regards,<br>
<br>
<br><span style="font-size: 12px;">##EMPLOYEE_NAME##&nbsp;</span><br>
<br>
</p>
HOD;

        $welcomeLetter = <<<HOD
<p><br></p><p><div style="text-align: center;"><b>Welcome Letter</b></div>
<br>
<br><span style="font-size: 12px;">##EMPLOYEE_NAME##</span><br><span style="font-size: 12px;">##EMPLOYEE_ADDRESS##</span><br>
<br>
<br>
Date:&nbsp;<span style="font-size: 12px;"><b>##EMPLOYEE_JOINING_DATE##</b></span><br>
<br>
Dear&nbsp;<span style="font-size: 12px;">##EMPLOYEE_NAME##</span>, <br>
<br>
We are extremely glad and happy as a corporation to welcome you to our company&nbsp;<span style="font-size: 12px;">&nbsp;<b>##COMPANY_NAME##</b></span>&nbsp;from the&nbsp;<span style="font-size: 12px;"><b>##EMPLOYEE_JOINING_DATE##</b>&nbsp;</span>onwards.<br>
You shall be filling the position with Software Developer in the technical department, and we wish to inform you that this is one of the most crucial job positions in our company. We are looking forward to see you prove us right in the decision to hire you over the other great applicants as far as qualifications and experience is concerned.<br>
<br>
Our company shall welcome you and I am sure you would be able to fit in comfortably. We hope you realize your duties and help us grow further as far as the success and development is concerned.<br>
Welcome once again!<br>
<br>
<br>
_____________________________<br><span style="font-size: 12px;">##SIGNATORY##</span><br><span style="font-size: 12px;">##SIGNATORY_DESIGNATION## - ##SIGNATORY_DEPARTMENT##&nbsp;</span><br><span style="font-size: 12px;">&nbsp;##COMPANY_NAME##</span><br>
<br>
</p>

HOD;

        $relievingLetter = <<<HOD

<br>
<br>
<br>
<br>
Date:&nbsp;<span style="font-size: 12px;">##EMPLOYEE_EXIT_DATE##</span><br><div style="text-align: center;"><b>Relieving Letter &amp; Experience Certificate&nbsp;</b></div><div style="text-align: center;"><b><br></b></div>
Employee Name:&nbsp;<span style="font-size: 12px;">##EMPLOYEE_NAME##</span><br>
Employee Id:&nbsp;&nbsp;<span style="font-size: 12px;">##EMPLOYEE_ID##</span><br>
Designation:&nbsp;<span style="font-size: 12px;">##EMPLOYEE_DESIGNATION##</span>&nbsp;<br>
<br>
<br>
Dear&nbsp;<span style="font-size: 12px;">##EMPLOYEE_NAME##</span><br>
<br>
This is in reference to our discussion on <b><u>XXXTERMINATIONLETTERDATEXXX</u></b><br>
You will be relived from your duties at the end of our official working hours on&nbsp;<span style="font-size: 12px;"><b>##EMPLOYEE_EXIT_DATE##.</b></span><br>
We wish to express our sincere appreciation for your dedication &amp; hard work for the company during the period of your association from 15-Jan-2018 to 30-June-2018 with your last designation as Software Developer. <br>
We wish you good luck for all your future endeavours.<br>
<br>
Regards,<br><br><span style="font-size: 12px;">##SIGNATORY##</span><br><span style="font-size: 12px;">##SIGNATORY_DESIGNATION##&nbsp; - ##SIGNATORY_DEPARTMENT##</span><br>
<span style="font-size: 12px;">##COMPANY_NAME##</span><br>


HOD;

        $attendanceLetter = <<<HOD

<br><div style="text-align: center;"><b>Excellent Attendance Letter</b></div>
<br>
<br>
<br><span style="font-size: 12px;"><b>##EMPLOYEE_NAME##</b></span><br>
Employee ID:&nbsp;<span style="font-size: 12px;"><b>##EMPLOYEE_ID##</b></span><br>
Position:&nbsp;<span style="font-size: 12px;"><b>##EMPLOYEE_DESIGNATION##</b></span><br>
<br>
Date: XXXXCURRENT_DATEXXX<br>
<br>
<br>
Dear&nbsp;<span style="font-size: 12px;">##EMPLOYEE_NAME##</span>,	<br>
<br>
Thank you for your excellent attendance at work during the last 3 months. It is an honor and privilege to work with such a committed employee. The effort you put into your job is more than what is required and ##COMPANY_NAME## team is going to recognize you. You will receive a bonus as recognition for a well job done.  <br>
Thanks again for all that you do for our firm and keep up the great work.<br>
<br>
<br>
 <br>
<br>
_____________________________<br><span style="font-size: 12px;">##SIGNATORY##</span><br><span style="font-size: 12px;">##SIGNATORY_DESIGNATION##</span><br><span style="font-size: 12px;">##COMPANY_NAME##</span><br>
<br>



HOD;

        $letters = [
            [
                'title' => 'Joining Letter',
                'template' => $joiningLetter
            ],
            [
                'title' => 'Offer Letter',
                'template' => $offerLetter
            ],
            [
                'title' => 'Increment Letter',
                'template' => $incrementLetter
            ],
            [
                'title' => 'Acceptance Letter',
                'template' => $acceptanceLetter
            ],
            [
                'title' => 'Welcome Letter',
                'template' => $welcomeLetter
            ],
            [
                'title' => 'Relieving and Experience Letter',
                'template' => $relievingLetter
            ],
            [
                'title' => 'Excellent Attendance Letter',
                'template' => $attendanceLetter
            ]

        ];

        foreach ($letters as $letter) {

            $let = Template::where('company_id', $company->id)
                ->where('title', $letter['title'])
                ->first();

            if ($let) {
                $let->company_id = $company->id;
                $let->title = $letter['title'];

                $let->description = $letter['template'];
                $let->save();
                continue;
            }

            $let = new Template();
            $let->company_id = $company->id;
            $let->title = $letter['title'];

            $let->description = $letter['template'];
            $let->save();
        }

    }

}
