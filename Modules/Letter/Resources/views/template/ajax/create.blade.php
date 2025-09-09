<style>
    #description .ql-editor {
        min-height: 350px;
    }
</style>
<div class="row">
    <div class="col-sm-12">
        <x-form id="createLetter">
            <div class="add-client bg-white rounded">
                <h4 class="mb-0 p-20 f-21 font-weight-normal  border-bottom-grey">
                    @lang('letter::app.addTemplate')
                </h4>

                <div class="row p-20">
                    <div class="col-md-8">
                        <div class="col-md-12">
                            <x-forms.text fieldId="title" :fieldLabel="__('app.title')" fieldName="title" fieldRequired="true"
                                fieldPlaceholder="">
                            </x-forms.text>
                        </div>
                        <div class="col-md-12">
                            <x-forms.label class="my-3" fieldId="description-text" :fieldLabel="__('app.description')"
                                fieldRequired="true">
                            </x-forms.label>
                            <div id="description" class="h-auto mh-100"></div>
                            <textarea name="description" id="description-text" class="d-none"></textarea>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="col-12">
                            <h4 class="pl-2 mb-2 f-18 font-weight-normal ">
                                @lang('letter::app.availableVariables')
                            </h4>
                        </div>
                        @foreach (\Modules\Letter\Enums\LetterVariable::cases() as $variable)
                            <div class="col-md-12">
                                <div class="f-10 text-dark-grey my-2">
                                    <span role="button" class="btn-copy rounded " data-toggle="tooltip"
                                        data-original-title="@lang('letter::app.clickToCopy')"
                                        data-clipboard-target="#letter-variable-{{ $variable->name }}">
                                        <i class="fa fa-copy mx-1"></i></span>
                                    <span id="letter-variable-{{ $variable->name }}">{{ $variable->value }}</span>
                                </div>
                            </div>
                        @endforeach
                    </div>
                </div>

                <x-form-actions>
                    <x-forms.button-cancel :link="route('letter.template.index')" class="border-0 mr-3">@lang('app.cancel')
                    </x-forms.button-cancel>
                    <x-forms.button-primary id="save-letter" icon="check">@lang('app.save')</x-forms.button-primary>
                </x-form-actions>

            </div>

        </x-form>

    </div>
</div>

<script>
    $(document).ready(function() {
        quillImageLoad('#description');
        var quill = quillArray['#description'];
        quill.on('text-change', function() {
            $('#description-text').val(quill.root.innerHTML);
        });

        $('#save-letter').click(function() {
            var url = "{{ route('letter.template.store') }}";

            $.easyAjax({
                url: url,
                container: '#createLetter',
                type: "POST",
                blockUI: true,
                buttonSelector: "#save-letter",
                disableButton: true,
                data: $('#createLetter').serialize(),
                success: function(response) {
                    if (response.status == 'success') {
                        window.location.href = response.redirectUrl;
                    }
                }
            })
        });

        const clipboard = new ClipboardJS('.btn-copy');

        clipboard.on('success', function(e) {
            Swal.fire({
                icon: 'success',
                text: "{{ __('app.copied') }}",
                toast: true,
                position: 'top-end',
                timer: 3000,
                timerProgressBar: true,
                showConfirmButton: false,
                customClass: {
                    confirmButton: 'btn btn-primary',
                },
                showClass: {
                    popup: 'swal2-noanimation',
                    backdrop: 'swal2-noanimation'
                },
            })
        });

        init(RIGHT_MODAL);
    });
</script>
