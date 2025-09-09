<!DOCTYPE html>
<html lang="en">
    <head>
        <title>@lang('recruit::app.menu.offerletter') - #{{ $jobOffer->id }}</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <meta name="msapplication-TileColor" content="#ffffff">
        <meta name="msapplication-TileImage" content="{{ $company->favicon_url }}">
        <meta name="theme-color" content="#ffffff">

        <style>
            body {
                margin: 0;
                font-family: Verdana, Arial, Helvetica, sans-serif;
            }

            .bg-white {
                background-color: #fff;
            }

            .f-14 {
                font-size: 14px;
            }

            .f-14 {
                font-size: 14px;
            }

            .text-black {
                color: #28313c;
            }

            .text-grey {
                color: #616e80;
            }

            . {
                text-transform: capitalize;
                margin-bottom: 0;
            }

            .line-height {
                line-height: 24px;
            }

            .mb-0 {
                margin-bottom: 0px;
            }

            .rightaligned {
                margin-right: 0;
                margin-left: auto;
            }

            .mt-0 {
                margin-top: 0px;
            }

            .mt-2 {
                margin-top: 2rem;
            }

            .imgnew {
                height: 100px !important;
                width: 100px !important;
            }

            .new {
                height: 100% !important;
                width: 100% !important;
            }

            .f-21 {
                font-size: 21px;
            }

            .font-weight-700 {
                font-weight: 700;
            }

            .text-uppercase {
                text-transform: uppercase;
            }

            .logo {
                height: 50px;
            }

            .margin-bottom {
                margin-bottom: 20px;
            }

            .b-collapse {
                border-collapse: collapse;
            }

            .main-table-heading {
                border: 1px solid #DBDBDB;
                background-color: #f1f1f3;
                font-weight: 700;
            }

            .main-table-heading td {
                padding: 5px 8px;
                border: 1px solid #DBDBDB;
            }

            .text-bold {
                font-weight: bold;
            }

        </style>
    </head>

    <body class="content-wrapper">
        <table class="bg-white" border="0" cellpadding="0" cellspacing="0" width="100%" role="presentation">
            <tbody>
            <!-- Table Row Start -->
            <tr>
                <td><img src="{{ $company->logo_url }}" alt="{{ $company->company_name }}"
                        class="logo"/></td>
                <td align="right"
                    class="f-21 text-black font-weight-700 text-uppercase">@lang('recruit::modules.job.offerletter')</td>

            </tr>
            <!-- Table Row End -->
            <!-- Table Row Start -->
            <tr>
                <td>
                    <p class="line-height mt-1 mb-0 f-14 text-black">
                        {{ $company->company_name }}<br>
                        @if (!is_null($settings))
                            {{ $company->company_phone }}
                        @endif
                    </p>
                </td>
                <td>
                    <table class="text-black b-collapse rightaligned mr-4 mt-0">
                        <tr>
                            <td>
                                @if (!is_null($jobOffer->jobApplication->photo))
                                    <div class="jobApplicationImg mr-1 mt-2">
                                        <div class="imgnew">
                                            <img data-toggle="tooltip" class="new"
                                                data-original-title="{{ $jobOffer->jobApplication->name }}"
                                                src="{{ $jobOffer->jobApplication->image_url }}">
                                        </div>
                                    </div>
                                @endif
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
            <tr>
                <td height="10" colspan="2"></td>
            </tr>
            <h5 class="f-14 text-grey ">@lang('recruit::modules.joboffer.candidateDetails')</h5>
            <tr>
                <td class="f-14 text-black">
                    <p class="line-height mb-0">@lang('recruit::modules.jobApplication.name')</p>
                    <p class="line-height mb-0">@lang('recruit::modules.jobApplication.email')</p>
                </td>
                <td class="f-14 text-black">
                    <p class="line-height mb-0">{{ $jobOffer->jobApplication->full_name }}</p>
                    <p class="line-height mb-0">{{ $jobOffer->jobApplication->email }}</p>
                </td>
            </tr>
            <tr>
                <td height="10" colspan="2"></td>
            </tr>
            <h5 class="f-14 text-grey ">@lang('recruit::modules.joboffer.jobDetails')</h5>
            <tr>
                <td class="f-14 text-black">
                    <p class="line-height mb-0">@lang('recruit::modules.footerlinks.title')</p>
                    <p class="line-height mb-0">@lang('recruit::modules.joboffer.workExperience')</p>
                    <p class="line-height mb-0">@lang('recruit::modules.jobApplication.location')</p>
                </td>
                <td class="f-14 text-black">
                    <p class="line-height mb-0">{{ ucwords($jobOffer->job->title) }}</p>
                    @if($jobOffer->job->workExperience->work_experience == 'fresher')
                        <p class="line-height mb-0">{{ ($jobOffer->job->workExperience->work_experience) }}</p>
                    @else
                        <p class="line-height mb-0">{{ $jobOffer->job->workExperience->work_experience }} @lang('recruit::modules.joboffer.frontText')</p>
                    @endif
                    <p class="line-height mb-0">{{ $jobOffer->jobApplication->location->location ? $jobOffer->jobApplication->location->location : '' }}</p>
                </td>
            </tr>
          
            <tr>
                <td height="10" colspan="2"></td>
            </tr>
            <h5 class="f-14 text-grey ">@lang('recruit::modules.joboffer.offerDetail')</h5>
            <tr>
                <td class="f-14 text-black">
                    <p class="line-height mb-0">@lang('recruit::modules.joboffer.designation')</p>
                    @if(is_null($salaryStructure))
                        <p class="line-height mb-0">@lang('recruit::modules.joboffer.offerPer') ({{ $currency->currency_code }})</p>
                    @endif
                    <p class="line-height mb-0">@lang('recruit::modules.joboffer.joiningDate')</p>
                    <p class="line-height mb-0">@lang('recruit::modules.joboffer.lastDate')</p>
                    @if($jobOffer->description)
                        <p class="line-height mb-0">@lang('recruit::app.menu.description')</p>
                    @endif

                </td>
                <td class="f-14 text-black">

                    <p class="line-height mb-0">{{ $jobOffer->job->team->team_name }}</p>
                    @if(is_null($salaryStructure))
                        <p class="line-height mb-0">
                            @if($jobOffer->comp_amount)
                                {{ currency_format($jobOffer->comp_amount, $currency->id, false) }} @lang('recruit::modules.joboffer.per') {{ $jobOffer->job->pay_according }}
                            @else
                                @lang('recruit::app.menu.notDisclosed')
                            @endif
                        </p>
                    @endif
                    <p class="line-height mb-0">{{ $jobOffer->expected_joining_date->format('d-M, Y (l)') }}</p>
                    <p class="line-height mb-0">{{ $jobOffer->job_expire->format('d-M, Y (l)') }}</p>
                    <p class="line-height mb-0">{!! $jobOffer->description !!}</p>

                </td>
            </tr>
            </tbody>
        </table>
        @if(!is_null($salaryStructure))
            <h5 class="f-14 text-grey  mt-2">@lang('recruit::modules.joboffer.salaryStructure')</h5>
            <table width="100%">
                <tbody>
                <tr>
                    <td>
                        <table class="f-14 b-collapse" width="100%">
                            <tr>
                                <td colspan="2"></td>
                            </tr>
                            <tr class="main-table-heading text-grey">
                                <td width="40%">@lang('recruit::modules.joboffer.earning')</td>
                                <td align="right">@lang('app.amount') ({{ $currency->currency_code }})</td>
                            </tr>
                            <tr>
                                <td>@lang('recruit::modules.joboffer.basicPay')</td>
                                <td class="text-right text-uppercase" align="right">
                                    {{ $salaryStructure->basic_salary }}</td>
                            </tr>
                            @foreach ($selectedEarningsComponent as $item)
                                <tr>
                                    <td>{{ ($item->component_name) }}</td>
                                    <td class="text-right" align="right">{{ $item->component_value }}</td>
                                </tr>
                            @endforeach
                            <tr>
                                <td>@lang('recruit::modules.joboffer.fixedAllowance')</td>
                                <td class="text-right text-uppercase" align="right">
                                    {{ sprintf('%0.2f', $fixedAllowance) }}</td>
                            </tr>
                            <tr class="text-black text-bold line-height">
                                <td>@lang('recruit::modules.joboffer.ctc')</td>
                                <td class="text-uppercase" align="right">
                                    {{ sprintf('%0.2f', $grossSalary) }}
                                </td>
                            </tr>
                        </table>

                    </td>
                </tr>
                <tr>
                    <td>
                        <table class="f-14 b-collapse" width="100%">
                            <tr>
                                <td colspan="2"></td>
                            </tr>
                            <tr class="main-table-heading text-grey">
                                <td width="40%">@lang('recruit::modules.joboffer.deduction')</td>
                                <td align="right">@lang('app.amount') ({{ $currency->currency_code }})</td>
                            </tr>

                            @foreach ($selectedDeductionsComponent as $item)
                                <tr>
                                    <td>{{ ($item->component_name) }}</td>
                                    <td class="text-right" align="right">{{ sprintf('%0.2f', $item->component_value) }}</td>
                                </tr>
                            @endforeach

                            <tr class="text-black text-bold line-height">
                                <td>@lang('recruit::modules.joboffer.totalDeductions')</td>
                                <td align="right">{{ sprintf('%0.2f', $totalDeduction) }}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
                </tbody>
            </table>

            <div class="card-body">
                <div class="p-20 mt-3">
                    <div class="f-14 text-black">
                        <p class="text-bold mb-0">@lang('recruit::modules.joboffer.netSalary') : {{ sprintf('%0.2f', $netSalary) .' '.($currency->currency_code) }}</p>
                        <p class="mb-0">@lang('recruit::modules.joboffer.netSalary') =
                            @lang('recruit::modules.joboffer.grossEarning') - @lang('recruit::modules.joboffer.totalDeductions')</p>
                    </div>
                </div>
            </div>
        @endif

        @if (!is_null($jobOffer->sign_image))
            <div style="text-align: right; margin-top: 10px;">
                <h2 class="name f-14 text-black margin-bottom">@lang('recruit::modules.interviewSchedule.candidate') @lang('app.signature')</h2>
                {!! Html::image($jobOffer->file_url, '', ['class' => '', 'height' => '75px']) !!}
                <p class="f-14 text-black">({{ $jobOffer->jobApplication->full_name }}
                    @lang("recruit::app.menu.signedOffer")
                    {{$jobOffer->offer_accept_at->format($company->date_format)}})</p>
            </div>
        @endif

    </body>
</html>
