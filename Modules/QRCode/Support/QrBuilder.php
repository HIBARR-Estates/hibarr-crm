<?php

namespace Modules\QRCode\Support;

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Writer\EpsWriter;
use Endroid\QrCode\Writer\GifWriter;
use Endroid\QrCode\Writer\PdfWriter;
use Endroid\QrCode\Writer\PngWriter;
use Endroid\QrCode\Writer\SvgWriter;
use Endroid\QrCode\Writer\WebPWriter;

class QrBuilder extends Builder
{
    private $data = '';
    private $extension = null;
    private $size = null;

    public function svg()
    {
        $this->extension = 'svg';

        return $this->writer(new SvgWriter());
    }

    public function png()
    {
        $this->extension = 'png';

        return $this->writer(new PngWriter());
    }

    public function gif()
    {
        $this->extension = 'gif';

        return $this->writer(new GifWriter());
    }

    public function webp()
    {
        $this->extension = 'webp';

        return $this->writer(new WebPWriter());
    }

    public function pdf()
    {
        $this->extension = 'pdf';

        return $this->writer(new PdfWriter());
    }

    public function eps()
    {
        $this->extension = 'eps';

        return $this->writer(new EpsWriter());
    }

    public function setData($data)
    {
        $this->data = $data;

        return $this->data($data);
    }

    public function getData()
    {
        return $this->data;
    }

    public function getExtension()
    {
        return $this->extension;
    }

    public function response($download = null)
    {
        if (!$this->extension) {
            $this->png();
        }

        $qrCode = $this->build();

        $response = response($qrCode->getString())->header('Content-type', $qrCode->getMimeType());

        if ($download) {
            $filename = str()->random(10) . '.' .  $this->extension;
            $response->header('Content-Disposition', 'attachment; filename="' . $download . '-' . $filename . '"');
        }

        return $response;
    }

    public function save($path)
    {
        if (!$this->extension) {
            $this->png();
        }

        $qrCode = $this->build();

        $qrCode->saveToFile($path);
    }

    public function html()
    {
        if (!$this->extension) {
            $this->png();
        }

        if (in_array($this->extension, ['pdf', 'eps'])) {
            $this->png();
        }

        $qrCode = $this->build();

        return '<img src="' . $qrCode->getDataUri() . '" />';
    }

    public function setSize($size)
    {
        $this->size = $size;

        return $this->size($size);
    }

    public function getSize()
    {
        return $this->size;
    }

}
