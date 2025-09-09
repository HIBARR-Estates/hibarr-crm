<?php

namespace Modules\QRCode\Http\Controllers;

use App\Helper\Files;
use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\Currency;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Modules\QRCode\DataTables\QRCodeDataTable;
use Modules\QRCode\Entities\QRCodeSetting;
use Modules\QRCode\Entities\QrCodeData;
use Modules\QRCode\Enums\Format;
use Modules\QRCode\Enums\Type;
use Modules\QRCode\Http\Requests\QrPreview;
use Modules\QRCode\Support\QrCode;

class QRCodeController extends AccountBaseController
{

    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'qrcode::app.menu.qrcode';
        $this->middleware(function ($request, $next) {
            abort_403(!in_array(QRCodeSetting::MODULE_NAME, $this->user->modules));

            return $next($request);
        });
    }

    /**
     * Display a listing of the resource.
     */
    public function index(QRCodeDataTable $dataTable)
    {
        $this->viewQrCodePermission = user()->permission('view_qrcode');

        abort_403($this->viewQrCodePermission == 'none');

        return $dataTable->render('qrcode::qrcode.index', $this->data);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function show(int $id)
    {
        $this->viewQrCodePermission = user()->permission('view_qrcode');

        abort_403($this->viewQrCodePermission == 'none');

        $this->qrCodeData = QrCodeData::findOrFail($id);

        $this->qr = QrCode::buildQrCode($this->qrCodeData)->png()->build()->getDataUri();

        return view('qrcode::qrcode.show', $this->data);

    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        $this->addPermission = user()->permission('add_qrcode');
        abort_403($this->addPermission !== 'all');

        $this->view = 'qrcode::qrcode.ajax.create';

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        return view('qrcode::qrcode.create', $this->data);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(QrPreview $request)
    {
        if ($request->qrId) {
            $this->editPermission = user()->permission('edit_qrcode');
            abort_403($this->editPermission !== 'all');
        }
        else {
            $this->addPermission = user()->permission('add_qrcode');
            abort_403($this->addPermission !== 'all');
        }

        $qrCodeData = QrCodeData::findOrNew($request->qrId);
        $qrCodeData->company_id = $this->company->id;
        $qrCodeData->title = $request->qrTitle;
        $qrCodeData->type = $request->type;
        $qrCodeData->size = $request->size;
        $qrCodeData->margin = $request->margin;
        $qrCodeData->foreground_color = $request->foreground_color;
        $qrCodeData->background_color = $request->background_color;
        $qrCodeData->form_data = $request->except([
            '_token',
            'qrId',
            'qrTitle',
            'type',
            'size',
            'margin',
            'foreground_color',
            'background_color',
            'logo',
            'logo_size',
            'f_email',
            'f_slack_username',
            'redirect_url',
        ]);

        $qr = $this->qrGenerate($request);

        $qrCodeData->data = $qr->getData();

        if ($request->logo_delete == 'yes') {
            Files::deleteFile($qrCodeData->logo, QrCodeData::LOGO_PATH);
            $qrCodeData->logo = null;
        }

        if ($request->hasFile('logo')) {

            if ($qrCodeData->logo) {
                Files::deleteFile($qrCodeData->logo, QrCodeData::LOGO_PATH);
            }

            $qrCodeData->logo = Files::uploadLocalOrS3($request->logo, QrCodeData::LOGO_PATH);
        }

        $qrCodeData->logo_size = $request->logo_size;

        $qrCodeData->save();

        $qr = $qr->svg()->build()->getDataUri();

        return Reply::successWithData( __('messages.recordSaved'), ['qr' => $qr, 'id' => $qrCodeData->id]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(int $id)
    {
        $this->editPermission = user()->permission('edit_qrcode');
        abort_403($this->editPermission !== 'all');

        $this->qrCodeData = QrCodeData::findOrFail($id);
        $this->formFields = $this->qrCodeData->form_data;

        if ($this->qrCodeData->type == Type::paypal) {
            $this->currencies = Currency::get();
        }

        $this->qr = QrCode::buildQrCode($this->qrCodeData)->png()->build()->getDataUri();

        $this->view = 'qrcode::qrcode.ajax.edit';

        if (request()->ajax()) {
            $html = view($this->view, $this->data)->render();
            return Reply::dataOnly(['status' => 'success', 'html' => $html, 'title' => $this->pageTitle]);
        }

        return view('qrcode::qrcode.create', $this->data);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $id)
    {
        $deletePermission = user()->permission('delete_qrcode');
        abort_403($deletePermission !== 'all');

        $qrCodeData = QrCodeData::findOrFail($id);

        if ($qrCodeData->logo) {
            Files::deleteFile($qrCodeData->logo, QrCodeData::LOGO_PATH);
        }

        $qrCodeData->delete();
        return Reply::success(__('messages.deleteSuccess'));
    }

    /**
     * Download the specified resource from storage.
     */
    public function download(int $id, Format $format)
    {
        $this->viewQrCodePermission = user()->permission('view_qrcode');
        abort_403($this->viewQrCodePermission == 'none');

        $qrCodeData = QrCodeData::findOrFail($id);
        $qr = QrCode::buildQrCode($qrCodeData)->{$format->value}();

        return $qr->response($qrCodeData->title);
    }

    /**
     * Get the specified resource from storage.
     */
    public function fields(Type $type)
    {
        $view = 'qrcode::qrcode.fields.' . $type->value;

        if (!view()->exists($view)) {
            return Reply::error(__('qrcode::app.invalidType'));
        }

        if ($type == Type::paypal) {
            $this->currencies = Currency::get();
        }

        $html = view($view, $this->data)->render();

        return Reply::dataOnly(['status' => 'success', 'view' => $html]);
    }

    public function preview(QrPreview $request)
    {
        $this->viewQrCodePermission = user()->permission('view_qrcode');
        abort_403($this->viewQrCodePermission == 'none');

        $qr = $this->qrGenerate($request);

        $qr = $qr->svg()->build()->getDataUri();

        return Reply::dataOnly(['status' => 'success', 'qr' => $qr]);
    }

    private function qrGenerate(QrPreview $request)
    {
        $qr = match (Type::tryFrom($request->type)) {
            Type::email => QrCode::email($request->email, $request->subject, $request->message),
            Type::event => $this->qrEvent($request),
            Type::geo => QrCode::geo($request->latitude, $request->longitude),
            Type::paypal => QrCode::paypal($request->email, $request->itemName, $request->amount, $request->itemId, $request->paymentType, $request->currency, $request->shipping, $request->tax),
            Type::skype => QrCode::skype($request->username, $request->skypeContactType),
            Type::sms => QrCode::sms($request->mobile, $request->country_phonecode, $request->message),
            Type::tel => QrCode::tel($request->mobile, $request->country_phonecode),
            Type::text => QrCode::text($request->message),
            Type::upi => QrCode::upi($request->upi, $request->amount, $request->name, $request->description),
            Type::url => QrCode::url($request->url),
            Type::whatsapp => QrCode::whatsapp($request->mobile, $request->country_phonecode, $request->message),
            Type::wifi => QrCode::wifi($request->name, $request->password, $request->encryption, $request->hidden),
            Type::zoom => QrCode::url($request->url),
            default => QrCode::text($request->message ?: ''),
        };

        $qrSize = $request->size ?? 400;
        $qrMargin = $request->margin ?? 10;

        $qr->size($qrSize)
            ->margin($qrMargin)
            ->backgroundColor(QrCode::color($request->background_color ?? '#ffffff'))
            ->foregroundColor(QrCode::color($request->foreground_color ?? '#000000'));

        if ($request->logo) {
            $qr->logoPath($request->logo);

            if ($request->logo_size) {
                $qr->logoResizeToWidth(QrCode::qrLogoSize($qrSize, $request->logo_size));
            }
        }

        return $qr;
    }

    private function qrEvent(QrPreview $request)
    {
        $startDateTime = Carbon::createFromFormat($this->company->date_format . ' ' . $this->company->time_format, $request->start_date . ' ' . $request->start_time);

        $endDateTime = Carbon::createFromFormat($this->company->date_format . ' ' . $this->company->time_format, $request->end_date . ' ' . $request->end_time, $this->company->timezone);

        return QrCode::event($request->title, $startDateTime, $endDateTime, $request->location, $request->link, $request->note, $request->reminder);
    }

}
