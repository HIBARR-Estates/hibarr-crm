@php
    $viewLeadCategoryPermission = user()->permission('view_lead_category');
    $viewLeadSourcesPermission = user()->permission('view_lead_sources');
    $addLeadSourcesPermission = user()->permission('add_lead_sources');
    $addLeadCategoryPermission = user()->permission('add_lead_category');
    $addProductPermission = user()->permission('add_product');
@endphp

<link rel="stylesheet" href="{{ asset('vendor/css/dropzone.min.css') }}">

<div class="row">
    <div class="col-sm-12">
        <x-form id="save-lead-data-form" method="PUT">
            <div class="add-client bg-white rounded">
                <div class="flex justify-between items-center p-4 border-b border-gray-200">
                    <h4 class="mb-0 f-21 font-weight-normal">
                        @lang('modules.leadContact.leadDetails')
                    </h4>
                    @if (isset($customFieldCategories) && count($customFieldCategories) > 0)
                        <div class="flex gap-2">
                            <button type="button"
                                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 hover:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                                data-category-id="general" data-active="true">
                                @lang('app.generalInformation')
                            </button>
                            @foreach ($customFieldCategories as $category)
                                <button type="button"
                                    class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
                                    data-category-id="{{ $category->id }}">
                                    {{ $category->name }}
                                </button>
                            @endforeach
                        </div>
                    @endif
                </div>

                <div id="normal-fields-container">
                    <div class="row p-20">
                        <div class="col-lg-4 col-md-6">
                            <x-forms.select fieldId="salutation" :fieldLabel="__('modules.client.salutation')" fieldName="salutation">
                                <option value="">--</option>
                                @foreach ($salutations as $salutation)
                                    <option value="{{ $salutation->value }}" @selected($leadContact->salutation == $salutation)>
                                        {{ $salutation->label() }}</option>
                                @endforeach
                            </x-forms.select>
                        </div>

                        <div class="col-lg-4 col-md-6">
                            <x-forms.text :fieldLabel="__('app.name')" fieldName="client_name" fieldId="client_name"
                                fieldPlaceholder="" fieldRequired="true" :fieldValue="$leadContact->client_name" />
                        </div>

                        <div class="col-lg-4 col-md-6">
                            <x-forms.email fieldId="client_email" :fieldLabel="__('app.email')" fieldName="client_email"
                                :fieldPlaceholder="__('placeholders.email')" :fieldValue="$leadContact->client_email" :fieldHelp="__('modules.lead.leadEmailInfo')">
                            </x-forms.email>
                        </div>

                        <div class="col-lg-4 col-md-6">
                            <x-forms.tel fieldId="mobile" :fieldLabel="__('modules.lead.mobile')" fieldName="mobile" :fieldPlaceholder="__('placeholders.mobile')"
                                :fieldValue="$leadContact->mobile"></x-forms.tel>
                        </div>

                        @if ($viewLeadSourcesPermission != 'none')
                            <div class="col-lg-4 col-md-6">
                                <x-forms.label class="my-3" fieldId="source_id" :fieldLabel="__('modules.lead.leadSource')">
                                </x-forms.label>
                                <x-forms.input-group>
                                    <select class="form-control select-picker" name="source_id" id="source_id"
                                        data-live-search="true">
                                        <option value="">--</option>
                                        @foreach ($sources as $source)
                                            <option @if ($leadContact->source_id == $source->id) selected @endif
                                                value="{{ $source->id }}">
                                                {{ $source->type }}</option>
                                        @endforeach
                                    </select>

                                    @if ($addLeadSourcesPermission == 'all' || $addLeadSourcesPermission == 'added')
                                        <x-slot name="append">
                                            <button type="button"
                                                class="btn btn-outline-secondary border-grey add-lead-source"
                                                data-toggle="tooltip"
                                                data-original-title="{{ __('app.add') . ' ' . __('modules.lead.leadSource') }}">@lang('app.add')</button>
                                        </x-slot>
                                    @endif
                                </x-forms.input-group>
                            </div>
                        @endif

                        <div class="col-lg-4 col-md-6">
                            <x-forms.select fieldId="lead_owner" :fieldLabel="__('app.owner')" fieldName="lead_owner">
                                <option value="">--</option>
                                @foreach ($employees as $item)
                                    <x-user-option :user="$item" :selected="$leadContact->lead_owner == $item->id" />
                                @endforeach
                            </x-forms.select>
                        </div>

                    </div>

                    <div class="row p-20">
                        <div class="col-lg-4 col-md-6">
                            <div class="form-group">
                                <div class="mt-2 d-flex">
                                    <x-forms.checkbox fieldId="create_client" :fieldLabel="__('modules.deal.createClient')"
                                        fieldName="create_client" :checked="isset($deal) && $deal->create_client == 1" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                @if (isset($customFieldCategories) && count($customFieldCategories) > 0)
                    @foreach ($customFieldCategories as $category)
                        <div class="row p-20 custom-fields-category-container"
                            id="custom-fields-category-{{ $category->id }}" style="display: none;">
                            <x-forms.custom-field :fields="$fields" :model="$leadContact"
                                :categoryId="$category->id"></x-forms.custom-field>
                        </div>
                    @endforeach
                @endif

                {{-- 
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-top-grey">
                    @lang('modules.lead.companyDetails')</h4>


                <div class="row p-20">

                    <div class="col-lg-3 col-md-6">
                        <x-forms.text :fieldLabel="__('modules.lead.companyName')" fieldName="company_name" fieldId="company_name"
                            :fieldPlaceholder="__('placeholders.company')" :fieldValue="$leadContact->company_name" />
                    </div>

                    <div class="col-lg-3 col-md-6">
                        <x-forms.text :fieldLabel="__('modules.lead.website')" fieldName="website" fieldId="website" :fieldPlaceholder="__('placeholders.website')"
                            :fieldValue="$leadContact->website" />
                    </div>

                    <div class="col-lg-3 col-md-6">
                        <x-forms.tel fieldId="mobile" :fieldLabel="__('modules.lead.mobile')" fieldName="mobile" :fieldPlaceholder="__('placeholders.mobile')"
                            :fieldValue="$leadContact->mobile"></x-forms.tel>
                    </div>

                    <div class="col-lg-3 col-md-6">
                        <x-forms.text :fieldLabel="__('modules.client.officePhoneNumber')" fieldName="office" fieldId="office" fieldPlaceholder=""
                            :fieldValue="$leadContact->office" />
                    </div>

                    <div class="col-lg-3 col-md-6">
                        <x-forms.select fieldId="country" :fieldLabel="__('app.country')" fieldName="country" search="true">
                            <option value="">--</option>
                            @foreach ($countries as $item)
                                <option @if ($leadContact->country == $item->nicename) selected @endif
                                    data-tokens="{{ $item->iso3 }}"
                                    data-content="<span class='flag-icon flag-icon-{{ strtolower($item->iso) }} flag-icon-squared'></span> {{ $item->nicename }}"
                                    value="{{ $item->nicename }}">{{ $item->nicename }}</option>
                            @endforeach
                        </x-forms.select>
                    </div>

                    <div class="col-lg-3 col-md-6">
                        <x-forms.text :fieldLabel="__('modules.stripeCustomerAddress.state')" fieldName="state" fieldId="state" :fieldPlaceholder="__('placeholders.state')"
                            :fieldValue="$leadContact->state" />
                    </div>

                    <div class="col-lg-3 col-md-6">
                        <x-forms.text :fieldLabel="__('modules.stripeCustomerAddress.city')" fieldName="city" :fieldValue="$leadContact->city" fieldId="city"
                            :fieldPlaceholder="__('placeholders.city')" />
                    </div>

                    <div class="col-lg-3 col-md-6">
                        <x-forms.text :fieldLabel="__('modules.stripeCustomerAddress.postalCode')" fieldName="postal_code" fieldId="postal_code"
                            :fieldPlaceholder="__('placeholders.postalCode')" :fieldValue="$leadContact->postal_code" />
                    </div>

                    <div class="col-md-12">
                        <div class="form-group my-3">
                            <x-forms.textarea class="mr-0 mr-lg-2 mr-md-2" :fieldLabel="__('app.address')" fieldName="address"
                                fieldId="address" :fieldPlaceholder="__('placeholders.address')" :fieldValue="$leadContact->address">
                            </x-forms.textarea>
                        </div>
                    </div>

                </div> --}}
                <x-form-actions>
                    <x-forms.button-primary id="save-lead-form" class="mr-3" icon="check">@lang('app.save')
                    </x-forms.button-primary>
                    <x-forms.button-cancel :link="route('lead-contact.index')" class="border-0">@lang('app.cancel')
                    </x-forms.button-cancel>
                </x-form-actions>

            </div>
        </x-form>

    </div>
</div>


<script>
    $(document).ready(function() {
        // Category tab click handler
        $('[data-category-id]').on('click', function() {
            var categoryId = $(this).attr('data-category-id');
            // Remove highlight from all buttons
            $('[data-category-id]').removeClass(
                'active-category bg-blue-600 text-white border-blue-600').addClass(
                'bg-white text-gray-700 border-gray-300');
            // Add highlight to the clicked button
            $(this).addClass('active-category bg-blue-600 text-white border-blue-600').removeClass(
                'bg-white text-gray-700 border-gray-300');
            if (categoryId === 'general') {
                $('#normal-fields-container').show();
                $('.custom-fields-category-container').hide();
            } else {
                $('#normal-fields-container').hide();
                $('.custom-fields-category-container').hide();
                $('#custom-fields-category-' + categoryId).show();
            }
        });
        // Default state: highlight 'General Information'
        $('[data-category-id="general"]').addClass('active-category bg-blue-600 text-white border-blue-600')
            .removeClass('bg-white text-gray-700 border-gray-300');
        $('#normal-fields-container').show();
        $('.custom-fields-category-container').hide();
    });
</script>


<script>
    $(document).ready(function() {

        $('.custom-date-picker').each(function(ind, el) {
            datepicker(el, {
                position: 'bl',
                ...datepickerConfig
            });
        });

        $('#save-lead-form').click(function() {
            const url = "{{ route('lead-contact.update', [$leadContact->id]) }}";
            $.easyAjax({
                url: url,
                container: '#save-lead-data-form',
                type: "POST",
                disableButton: true,
                blockUI: true,
                file: true,
                buttonSelector: "#save-lead-form",
                data: $('#save-lead-data-form').serialize(),
                success: function(response) {
                    window.location.href = response.redirectUrl;
                }
            });
        });

        $('body').on('click', '.add-lead-source', function() {
            const url = '{{ route('lead-source-settings.create') }}';
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('body').on('click', '.add-lead-category', function() {
            var url = '{{ route('leadCategory.create') }}';
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('#create_task_category').click(function() {
            const url = "{{ route('taskCategory.create') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('#department-setting').click(function() {
            const url = "{{ route('departments.create') }}";
            $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_LG, url);
        });

        $('#client_view_task').change(function() {
            $('#clientNotification').toggleClass('d-none');
        });

        $('#set_time_estimate').change(function() {
            $('#set-time-estimate-fields').toggleClass('d-none');
        });

        $('.toggle-other-details').click(function() {
            $(this).find('svg').toggleClass('fa-chevron-down fa-chevron-up');
            $('#other-details').toggleClass('d-none');
        });

        $('#createTaskLabel').click(function() {
            const url = "{{ route('task-label.create') }}";
            $(MODAL_XL + ' ' + MODAL_HEADING).html('...');
            $.ajaxModal(MODAL_XL, url);
        });

        $('#add-project').click(function() {
            $(MODAL_XL).modal('show');
            const url = "{{ route('projects.create') }}";
            $.easyAjax({
                url: url,
                blockUI: true,
                container: MODAL_XL,
                success: function(response) {
                    if (response.status == "success") {
                        $(MODAL_XL + ' .modal-body').html(response.html);
                        $(MODAL_XL + ' .modal-title').html(response.title);
                        init(MODAL_XL);
                    }
                }
            });
        });

        $('#add-employee').click(function() {
            $(MODAL_XL).modal('show');

            const url = "{{ route('employees.create') }}";

            $.easyAjax({
                url: url,
                blockUI: true,
                container: MODAL_XL,
                success: function(response) {
                    if (response.status == "success") {
                        $(MODAL_XL + ' .modal-body').html(response.html);
                        $(MODAL_XL + ' .modal-title').html(response.title);
                        init(MODAL_XL);
                    }
                }
            });
        });

        <x-forms.custom-field-filejs/>

        init(RIGHT_MODAL);
    });

    function checkboxChange(parentClass, id){
        let checkedData = '';
        $('.'+parentClass).find("input[type= 'checkbox']:checked").each(function () {
            checkedData = (checkedData !== '') ? checkedData+', '+$(this).val() : $(this).val();
        });
        $('#'+id).val(checkedData);
    }
</script>
