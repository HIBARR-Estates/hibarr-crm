@extends('layouts.app')

@section('content')

    <!-- SETTINGS START -->
    <div class="w-100 d-flex ">

        @include('sections.setting-sidebar')

        <x-setting-card>
            <x-slot name="header">
                <div class="s-b-n-header" id="tabs">
                    <h2 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                        @lang($pageTitle)</h2>
                </div>
            </x-slot>

            <div class="col-lg-12 col-md-12 ntfcn-tab-content-left w-100 p-4 ">
                @method('PUT')
                <div class="row">
                    <div class="col-lg-6">
                        <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                                      :fieldLabel="__('modules.accountSettings.companyName')"
                                      :fieldPlaceholder="__('placeholders.company')" fieldRequired="true"
                                      fieldName="company_name"
                                      :popover="__('messages.companyNameTooltip')"
                                      fieldId="company_name" :fieldValue="company()->company_name"/>
                    </div>
                    <div class="col-lg-6">
                        <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                                      :fieldLabel="__('modules.accountSettings.companyEmail')"
                                      :fieldPlaceholder="__('placeholders.email')" fieldRequired="true"
                                      fieldName="company_email"
                                      fieldId="company_email" :fieldValue="company()->company_email"/>

                    </div>
                </div>

                <div class="row">
                    <div class="col-lg-6">
                        <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                                      :fieldLabel="__('modules.accountSettings.companyPhone')"
                                      :fieldPlaceholder="__('placeholders.mobileWithPlus')" fieldRequired="true" fieldName="company_phone"
                                      fieldId="company_phone" :fieldValue="company()->company_phone"/>
                    </div>
                    <div class="col-lg-6">
                        <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                                      :fieldLabel="__('modules.accountSettings.companyWebsite')"
                                      :fieldPlaceholder="__('placeholders.website')" fieldRequired="false"
                                      fieldName="website"
                                      fieldId="website" :fieldValue="company()->website"/>
                    </div>
                    <div class="col-lg-6">
                        {{-- <x-forms.text class="mr-0 mr-lg-2 mr-md-2"
                                      :fieldLabel="__('modules.accountSettings.companyDefaultLeadCreator')"
                                      :fieldPlaceholder="__('placeholders.website')" fieldRequired="false"
                                      fieldName="website"
                                      fieldId="website" :fieldValue="company()->website"/> --}}
                        <x-forms.select  :fieldLabel="__('modules.accountSettings.companyDefaultLeadCreator')" fieldName="default_lead_creator_id" fieldId="default_lead_creator_id"
                            :fieldPlaceholder="__('placeholders.selectUser')" fieldRequired="false">
                            <option value="">--</option>
                            @foreach ($employees as $item)
                                <x-user-option :user="$item" :selected="company()->default_lead_creator_id == $item->id" />
                            @endforeach
                        </x-forms.select>
                    </div>
                </div>

                <hr class="my-4">

                <div class="row">
                    <div class="col-lg-6">
                        <div class="form-group my-3">
                            <label for="meeting_attendance_confirmation_enabled_at">
                                Meeting attendance confirmation — active since
                            </label>
                            <input type="datetime-local" class="form-control height-35 f-14"
                                   name="meeting_attendance_confirmation_enabled_at"
                                   id="meeting_attendance_confirmation_enabled_at"
                                   value="{{ company()->meeting_attendance_confirmation_enabled_at?->format('Y-m-d\TH:i') }}">
                            <small class="form-text text-muted">
                                Only meetings scheduled after this moment are ever prompted for an
                                attendance outcome. Leave blank to let it activate automatically the
                                next time the feature is checked for this company.
                            </small>
                        </div>
                    </div>
                </div>

            </div>

            <x-slot name="action">
                <!-- Buttons Start -->
                <div class="w-100 border-top-grey">
                    <x-setting-form-actions>
                        <x-forms.button-primary id="save-form" class="mr-3" icon="check">@lang('app.save')
                        </x-forms.button-primary>
                        </x-setting-form-actions>
                </div>
                <!-- Buttons End -->
            </x-slot>

        </x-setting-card>

    </div>
    <!-- SETTINGS END -->
@endsection

@push('scripts')
    <script>
        $('#save-form').click(function () {
            var url = "{{ route('company-settings.update', company()->id) }}";

            $.easyAjax({
                url: url,
                container: '#editSettings',
                type: "POST",
                disableButton: true,
                blockUI: true,
                buttonSelector: "#save-form",
                data: $('#editSettings').serialize(),
            })
        });
    </script>
@endpush
