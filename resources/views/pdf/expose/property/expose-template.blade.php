  <style>
        @page {
            /* size: A4 landscape; */
            size: 373.33mm 210mm;
            margin: 0;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;
            color: #333333;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
        }

        .page {
            /* height: 210mm; */
            width: 373.33mm;
            height: 210mm;
            position: relative;
            page-break-after: always;
            overflow: hidden;
            background: white;
        }

        .page:last-child {
            page-break-after: auto;
        }

        .bg {
            background-image: var(--bg-image);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            min-height: 100%;
        }

        .logo img {
            width: 30%;
        }

        .logo-watermark-top,
        .logo-watermark-bottom {
            position: absolute;
            display: flex;
            justify-content: flex-end;
        }

        .logo-watermark-top {
            top: 5mm;
            right: 5mm;
        }

        .logo-watermark-bottom {
            bottom: 10mm;
            right: 10mm;
        }

        .logo-watermark-top img,
        .logo-watermark-bottom img {
            width: 80%;
            height: auto;
        }

        .expose-title {
            display: flex;
            align-items: center;
            position: relative;
        }

        .expose-title img {
            position: relative;
            z-index: 2;
        }

        .expose-title .text {
            height: 3rem;
            border-right: 0.375rem solid #053160;
            border-bottom: 0.375rem solid #053160;
            border-radius: 0 4rem 4rem 0;
            padding: 12px 2rem;
            display: flex;
            align-items: center;
            position: absolute;
            left: 20%;
            z-index: 1;
            padding-left: 2rem;
            white-space: nowrap;
        }

        .expose-title .text h1 {
            color: #053160;
        }

        .expose-title .text.blue {
            background-color: #053160;
        }

        .expose-title .text.blue h1 {
            color: white;
        }

        .block-title {
            position: relative;
            width: 100%;
        }

        .block-title img {
            position: relative;
            z-index: 1;
            width: 100%;
        }

        .block-title .text {
            display: flex;
            align-items: flex-start;
            justify-content: center;
            text-align: center;
            position: absolute;
            top: 65%;
            left: 8%;
            width: 84%;
            height: 30%;
            z-index: 2;
            padding: 0.25rem 0.5rem;
        }

        .panther-bg {
            position: absolute;
            bottom: 0;
            right: 0;
            height: 100%;
            width: 100%;
            z-index: 0;
            pointer-events: none;
        }

        .panther-dual-left,
        .panther-dual-right {
            position: absolute;
            bottom: 0;
            height: 85%;
            width: auto;
            z-index: 0;
            pointer-events: none;
        }

        .panther-dual-right {
            right: 0;
            transform: scaleX(-1);
        }

        .panther-dual-left {
            left: 0;

        }

        .airport-grid {
            display: flex;
            flex-direction: column;
            height: 100%;
            gap: 1rem;
            padding: 1rem 0;
            box-sizing: border-box;
            overflow: visible;
        }

        .airport-row {
            display: flex;
            flex: 1;
            gap: 1rem;
        }

        .airport-map {
            flex: 1;
            overflow: visible;
            border-radius: 0.5rem;
            position: relative;
            z-index: 2;
        }

        .airport-map>img {
            width: 100%;
            height: calc(100% + 30px);
            object-fit: cover;
            border-radius: 0.5rem;
            display: block;
        }

        .map-pin {
            position: absolute;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25rem;
            transform: translateX(-50%);
        }

        .map-pin-label {
            background: #f12200;
            color: white;
            font-size: 8px;
            font-weight: 700;
            padding: 0.15rem 0.35rem;
            border-radius: 0.2rem;
            white-space: nowrap;
            text-align: center;
            line-height: 1.3;
        }

        .map-pin img {
            width: 14px;
            height: auto;
            display: block;
        }

        .airport-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            gap: 0;
            flex: 1;
        }

        .airport-item img {
            width: 100%;
            height: 212px;
            object-fit: cover;
            margin-bottom: 0.4rem;
        }

        .airport-item span {
            background: #053160;
            color: white;
            padding: 0.125rem 0.5rem;
            text-align: center;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 15.3px;
        }

        .airport-item p {
            font-weight: 600;
            color: #053160;
            margin: 0;
            font-size: 14px;
        }

        .airport-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 0 0 auto;
        }

        .airport-logo img {
            width: 80%;
            height: auto;
        }

        .items {
            padding-left: 60px;
        }

        .item {
            margin-bottom: 1.5rem;
        }

        .item-header {
            font-size: 16px;
            font-weight: 700;
            color: #053160;
            margin-bottom: 5px;
        }

        .item-value {
            font-size: 16px;
            color: #053160;
            font-weight: 400;
        }

        .item-list {
            list-style-type: disc;
            padding-left: 20px;
            margin: 0;
            color: #053160;
            font-size: 16px;
            line-height: 1.6;
        }

        .featured-grid {
            display: grid;
            grid-template-columns: 58.33% 41.67%;
            grid-template-rows: 1fr 1fr;
            gap: 10px;
            height: 100%;
            box-sizing: border-box;
        }

        .featured-grid>* {
            background-image: var(--bg-image);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            overflow: hidden;
        }

        .featured-grid .left-column {
            grid-row: 1/3;
        }

        .quad-grid {
            display: grid;
            grid-template-columns: 50% 50%;
            grid-template-rows: 1fr 1fr;
            gap: 10px;
            height: 100%;
            box-sizing: border-box;
        }

        .quad-grid>* {
            background-image: var(--bg-image);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            overflow: hidden;
        }

        .tri-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 10px;
          height: 100%;
          box-sizing: border-box;
        }
        .tri-grid > * {
          background-image: var(--bg-image);
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          overflow: hidden;
        }
        .tri-grid .bottom-wide {
          grid-column: 1/3;
        }

        .duo-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          height: 100%;
          box-sizing: border-box;
        }
        .duo-grid > * {
          background-image: var(--bg-image);
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          overflow: hidden;
        }

        .split-page {
            height: 100%;
            position: relative;
            display: flex;
            flex-direction: column;
        }

        .split-page .expose-title.absolute {
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            z-index: 10;
        }

        .split-page .expose-title .text {
            padding: 0.5rem 2rem 0.5rem 8rem;
        }

        .split-page .expose-title .text h1 {
            font-size: 32px;
        }

        .split-page .split-top {
            height: 55%;
            background-image: var(--bg-image);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
        }

        .split-page .split-bottom {
            position: relative;
            height: 45%;
            display: flex;
            align-items: center;
            padding: 2rem;
        }

        .split-page .split-bottom .container {
            max-width: 80%;
        }

        .split-page .split-bottom p {
            font-size: 16px;
            line-height: 1.8;
            color: #555555;
            text-align: justify;
            margin: 0;
        }

        .split-page .rock {
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
            width: 450px;
            height: 402px;
            position: absolute;
            right: 2%;
            bottom: 15%;

            /*
      Organic rock border radius
    */
            border-radius:
                53% 47% 58% 42% / 38% 52% 48% 62%;

            border: 8px solid white;

            transform: rotate(-4deg);

            box-shadow:
                0 20px 50px rgba(0, 0, 0, .12);
        }

        .split-page .rock img {
            width: 100%;
            height: 100%;
            object-fit: cover;

            /*
      Counter rotate image slightly
      so it feels natural
    */
            transform: scale(1.05) rotate(4deg);
        }

        /*
    EXTRA ROCK BUMPS
  */
        .split-page .rock::before,
        .rock::after {
            content: "";
            position: absolute;
            background: white;
            z-index: 3;
        }


        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(2, 1fr);
            height: 100%;
            gap: 22px;
        }

        .gallery-item {
            width: 100%;
            height: 100%;
            background: #f5f5f5;
            overflow: hidden;
            border: 0.0625rem solid #ccc;
            position: relative;
        }

        .gallery-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .gallery-item .title {
            position: absolute;
            left: 0;
            bottom: 1.75rem;
            padding: 0.75rem 1.25rem;
            font-size: 16px;
            background: linear-gradient(to right, white 80%, transparent 100%);
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .header .title {
            background: #053160;
            color: white;
            padding: 0.25rem 2rem;
            border-radius: 0 2rem 2rem 0;
            min-width: 150px;
            font-weight: 500;
            font-size: 32px;
        }

        .header .title.end {
            border-radius: 2rem 0 0 2rem;
        }

        .overflow-illustration {
            border-radius: 1rem;
            display: flex;
            width: 500px;
            height: 500px;
            transform: rotate(-45deg);
        }

        .overflow-illustration img {
            margin: auto;
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 2rem;
        }

        .illustration {
            overflow: hidden;
            height: 100%;
        }

        .illustration img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .row {
            display: flex;
            gap: 2rem;
            height: 100%;
            width: 100%;
        }

        .col-half {
            width: 50%;
            box-sizing: border-box;
        }

        .col-4 {
            width: 33.333333%;
            box-sizing: border-box;
        }

        .col-5 {
            width: 45.833333%;
            box-sizing: border-box;
        }

        .col-7 {
            width: 54.166667%;
            box-sizing: border-box;
        }

        .col-8 {
            width: 66.666667%;
            box-sizing: border-box;
        }

        .flex-center {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
        }

        .overview-layout {
            gap: 2rem;
        }

        .overview-layout .content {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 1rem;
            padding: 2rem 0;
        }

        .overview-layout .content p,
        .overview-layout .content h1 {
            padding-left: 12.5%;
        }

        .rounded-text {
            padding-left: 0 !important;
        }

        .container {
            padding: 15mm;
            height: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }

        h1 {
            font-size: 40px;
            font-weight: 700;
            color: #053160;
            margin: 0;
            line-height: 1.2;
        }

        h1 .more {
            font-weight: 400;
        }

        h2 {
            font-size: 20px;
            font-weight: 400;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #053160;
            margin: 0 0 25px 0;
            padding-bottom: 15px;
        }

        h3 {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #888888;
            margin: 0 0 5px 0;
        }

        p {
            font-size: 20px;
            line-height: 1.6;
            color: #555555;
            margin: 0;
        }

        .closure {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2rem;
            background: white;
            padding: 20px;
            border-radius: 2rem;
            height: 100%;
            width: 130mm;
            text-align: center;
        }

        .closure a {
            text-decoration: none;
            font-size: 20px;
            font-weight: 700;
            color: #053160;
        }

        .closure h2 {
            margin-bottom: 0;
            padding: 0;
        }

        .footer-brand {
            position: absolute;
            bottom: 15mm;
            left: 15mm;
            font-size: 10px;
            color: #ccc;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .page-num {
            position: absolute;
            bottom: 15mm;
            right: 15mm;
            font-size: 10px;
            color: #ccc;
        }

        .fw-500 {
            font-weight: 500;
        }

        .infrastructure .infrastructure-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
        }

        .infrastructure .grid-item {
            display: flex;
            flex-direction: column;
            gap: 0;
            align-items: center;
        }

        .infrastructure .grid-item img {
            width: 100%;
            height: 175px;
            object-fit: cover;
            margin-bottom: 0.5rem;
        }

        .infra-span {
            font-size: 16px;
        }

        .infra-p {
            font-size: 18.5px;
        }

        .infrastructure .grid-item span {
            background: #053160;
            color: white;
            padding: 0.125rem 0.5rem;
            text-align: center;
            border-radius: 0.5rem;
            font-weight: 600;
        }

        .infrastructure .grid-item p {
            font-weight: 600;
            color: #053160;
        }

        .infrastructure .grid-item:last-child:nth-child(odd) {
            grid-column: 1/-1;
            max-width: 50%;
            margin: 0 auto;
        }

        .unit-grid {
            display: grid;
            grid-template-columns: 30% 1fr;
            align-items: center;
            gap: 4rem;
            height: 100%;
        }

        .qr-cta {
            position: absolute;
            left: 96px;
            bottom: 120px;
            z-index: 10;
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .qr-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
        }

        .qr-column .qr-label {
            color: white;
            font-size: 16px;
            max-width: 185px;
            text-align: center;
            line-height: 1.4;
            font-weight: 600;
            margin: 0;
        }

        .qr-column .qr-box {
            width: 185px;
            height: 185px;
            background: white;
            overflow: hidden;
            flex-shrink: 0;
        }

        .qr-column .qr-box img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .qr-column .qr-scan {
            color: white;
            font-size: 24px;
            max-width: 185px;
            text-align: center;
            font-weight: 700;
            margin: 0;
        }

        .gallery-grid-2 {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: 1fr;
            height: 100%;
            gap: 22px;
        }

        .gallery-grid-4 {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(2, 1fr);
            height: 100%;
            gap: 22px;
        }

        .gallery-grid-8 {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            grid-template-rows: repeat(2, 1fr);
            height: 100%;
            gap: 14px;
        }

        .gallery-grid-8 .gallery-item .title {
            font-size: 13px;
        }

        .quad-grid-2 {
            display: grid;
            grid-template-columns: 50% 50%;
            grid-template-rows: 1fr;
            gap: 10px;
            height: 100%;
            box-sizing: border-box;
        }

        .quad-grid-2>* {
            background-image: var(--bg-image);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            overflow: hidden;
        }

        .quad-grid-6 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: 10px;
            height: 100%;
            box-sizing: border-box;
        }

        .quad-grid-6>* {
            background-image: var(--bg-image);
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            overflow: hidden;
        }
  </style>

  @php
    $pageNumber = 1;
    $heroImages = array_values($data['assets']['hero'] ?? []);
    $coverImages = array_values($data['assets']['cover'] ?? []);
    $exteriorImages = array_values($data['assets']['exterior'] ?? []);
    // $galleryImages = array_values($data['assets']['gallery'] ?? []);
    $galleryImages = array_values($data['assets']['interior'] ?? []);

    $globalExposeConfig = $data['expose_global_config'] ?? [];
    $outroConfig = $globalExposeConfig['outro'] ?? [];
    $qrConfig = $globalExposeConfig['qr'] ?? [];

    $outroTitle = $outroConfig['title'] ?? 'ROOTED IN BEAUTY, GROWING IN VALUE';
    $outroDescription = $outroConfig['description'] ?? (!empty($data['description']) ? Str::limit(strip_tags($data['description']), 280) : 'Discover luxury living at its finest...');
    $outroPrimaryImage = $outroConfig['primary_image_url'] ?? ($heroImages[0] ?? 'property/images/test.png');
    $outroSecondaryImage = $outroConfig['secondary_image_url'] ?? ($exteriorImages[4] ?? $outroPrimaryImage);

    $locationPayload = $data['location_payload'] ?? [];
    $locationTitle = $locationPayload['name'] ?? null;
    $locationDescription = $locationPayload['description'] ?? null;
    $locationImage = $locationPayload['image_url'] ?? null;
    $locationInfrastructure = array_values($data['location_infrastructure'] ?? []);
    $locationAirports = array_values($data['location_airports'] ?? []);

    $facilitySlugs = $data['facilities'] ?? [];
    $facilityLabels = $data['facility_labels'] ?? [];
    $facilityImagesBySlug = $data['facility_images_by_slug'] ?? [];
    $genericFacilityImages = array_values($data['assets']['facilities'] ?? []);

    $facilityItems = [];
    $genericFacilityIndex = 0;

    foreach ($facilitySlugs as $index => $slug) {
      $slugImages = array_values($facilityImagesBySlug[$slug] ?? []);
      $facilityItems[] = [
        'label' => $facilityLabels[$index] ?? ucfirst(str_replace('_', ' ', (string) $slug)),
        'image' => $slugImages[0] ?? ($genericFacilityImages[$genericFacilityIndex++] ?? null),
      ];
    }

    if (empty($facilityItems)) {
      foreach ($facilityLabels as $index => $label) {
        $facilityItems[] = [
          'label' => $label,
          'image' => $genericFacilityImages[$index] ?? null,
        ];
      }
    }

    if (empty($facilityItems)) {
      $fallbackNames = $data['exterior_features'] ?? [];
      foreach ($fallbackNames as $index => $label) {
        $facilityItems[] = [
          'label' => $label,
          'image' => $genericFacilityImages[$index] ?? null,
        ];
      }
    }

    $unitStyleList = array_values($data['unit_style_list'] ?? []);
    if (empty($unitStyleList) && !empty($data['unit_style'])) {
      if (is_array($data['unit_style'])) {
        $unitStyleList = array_values($data['unit_style']);
      } else {
        $unitStyleList = array_filter(array_map('trim', explode('/', (string) $data['unit_style'])));
      }
    }

    $galleryCursor = 0;
  @endphp

  <!-- PAGE 1: HERO -->
  <div class="page bg" style="--bg-image: url('{{ $heroImages[0] ?? 'property/images/test.png' }}')">
    <div class="container">
      <div class="logo">
        <img src="{{ $data['branding']['hibarr_expose_logo'] }}" alt="hibarr-expose-logo" />
      </div>
    </div>


    @if(!empty($data['client']['name']))
    <div style="position: absolute; bottom: 20mm; left: -10px;">
      <div style="position: relative; display: inline-block; line-height: 0;">


        <object data="{{ $data['branding']['expose_name_client'] }}" type="image/svg+xml"
                    style="height: 90px; width: 340px; display: block;"></object>

        <div style="position: absolute; top: 45%; left: 25%; transform: translateY(-50%); white-space: nowrap; line-height: 1.3;">
          <div style="font-size: 12px; font-weight: 400; color: #053160; letter-spacing: 1px; text-transform: uppercase;">Prepared for</div>
          <div style="font-size: 18px; font-weight: 700; color: #053160;">{{ $data['client']['name'] }}</div>
        </div>

      </div>
    </div>
    @endif

    
  </div>

  <!-- PAGE — Cover image (before property overview) -->
  @if(!empty($coverImages[0]))
  <div class="page bg" style="--bg-image: url('{{ $coverImages[0] }}')">
    <div class="logo-watermark-bottom">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
   
  </div>
  @endif

  <!-- PAGE 2: PROPERTY OVERVIEW -->
  <div class="page">
    {{-- Right: full-height image fading to transparent on the left --}}
    <div style="position: absolute; right: 0; top: 0; width: 55%; height: 100%; overflow: hidden; z-index: 0;">
      <img src="{{ $heroImages[0] ?? ($data['assets']['area'][0] ?? '') }}" alt="Property illustration"
        style="width: 100%; height: 100%; object-fit: cover; -webkit-mask-image: linear-gradient(to right, transparent 0%, black 38%); mask-image: linear-gradient(to right, transparent 0%, black 38%);" />
    </div>

    {{-- Left: content column --}}
    <div class="container" style="width: 50%; box-sizing: border-box; position: relative; z-index: 1;">
      <div class="expose-title">
        <img style="width: 25%" src="{{ $data['branding']['logo_rounded'] }}" alt="rounded" />
        <div class="text">
          <h1 style="margin-bottom: 0">PROPERTY OVERVIEW</h1>
        </div>
      </div>

      <div class="items" style="margin-top: 20px;">
        {{-- Location --}}
        <div class="item">
          <h3 class="item-header">CITY</h3>
          <div class="item-value">{{ $locationTitle ?? ($data['city'] ?? '—') }}</div>
        </div>

       
         {{-- Unit Styles: Studio / 1+1 / 1+1 Loft / 2+1 Loft --}}
        @if(!empty($unitStyleList))
            <div class="item">
              <h3 class="item-header">TYPES</h3>
              <div class="item-value">{{ implode(' / ', $unitStyleList) }}</div>
            </div>
        @endif

        {{-- Completion Date --}}
        <div class="item">
          <h3 class="item-header">Completion Date</h3>
          <div class="item-value">
            @php
              $completionRaw = $data['completion_date'] ?? null;
              if (!empty($completionRaw)) {
                try {
                  $completionDt = \Carbon\Carbon::parse($completionRaw);
                  $completionDisplay = $completionDt->isPast()
                    ? 'Ready to move in'
                    : $completionDt->format('d, M, Y');
                } catch (\Exception $e) {
                  $completionDisplay = $completionRaw;
                }
              } else {
                $completionDisplay = 'N/A';
              }
            @endphp
            {{ $completionDisplay }}
          </div>
        </div>

        {{-- Facilities --}}
        @if(!empty($facilityItems))
        <div class="item">
          <h3 class="item-header">FACILITIES</h3>
          <ul class="item-list">
            @foreach($facilityItems as $facility)
            <li>{{ $facility['label'] }}</li>
            @endforeach
          </ul>
        </div>
        @endif


      </div>
    </div>
  </div>

  <!-- PAGE 3: FEATURED IMAGES GRID -->
  <div class="page">
    <div class="container" style="padding: 3.70mm !important;">
      <div class="featured-grid">
        {{-- Left column: first exterior image with sharp_page_header label overlay --}}
        <div class="left-column" style="--bg-image: url('{{ $exteriorImages[0] ?? ($heroImages[0] ?? '') }}'); position: relative;">
          <div style="position: absolute; top: 5%; left: 0; z-index: 10;">
            <div style="position: relative; display: inline-block; line-height: 0;">
              <img src="{{ $data['branding']['sharp_page_header'] }}" alt="page-header"
                style="height: 72px; width: auto; display: block;" />
              <span
                style="position: absolute; top: 50%; left: 25%; transform: translateY(-50%); color: #053160; font-size: 17px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; white-space: nowrap;">Exterior</span>
            </div>
          </div>
        </div>
        {{-- Right top --}}
        <div class="right-top" style="--bg-image: url('{{ $exteriorImages[1] ?? ($heroImages[0] ?? '') }}')"></div>
        {{-- Right bottom --}}
        <div class="right-bottom" style="--bg-image: url('{{ $exteriorImages[2] ?? ($heroImages[0] ?? '') }}')"></div>
      </div>
    </div>
    <div class="logo-watermark-bottom">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
   
  </div>

  @php
    $remainingExterior = array_slice($exteriorImages, 3);
    $exteriorGridImages = array_slice($remainingExterior, 0, 4);
    $exteriorExtraImage = $remainingExterior[4] ?? null;
  @endphp

  <!-- PAGE — Exterior remainder page (grid/full depending on count, exterior[3+]) -->
  @if(!empty($remainingExterior))
      @if(count($exteriorGridImages) === 1)
        <div class="page bg" style="--bg-image: url('{{ $exteriorGridImages[0] }}')">
          <div class="logo-watermark-bottom">
            <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
          </div>
        </div>
      @elseif(count($exteriorGridImages) === 2)
        <div class="page">
          <div class="container" style="padding: 3.70mm !important;">
            <div class="duo-grid">
              <div style="--bg-image: url('{{ $exteriorGridImages[0] }}')"></div>
              <div style="--bg-image: url('{{ $exteriorGridImages[1] }}')"></div>
            </div>
          </div>

           <div class="logo-watermark-bottom">
              <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
            </div>
      </div>
      @elseif(count($exteriorGridImages) === 3)
      <div class="page">
          <div class="container" style="padding: 3.70mm !important;">
            <div class="tri-grid">
              <div style="--bg-image: url('{{ $exteriorGridImages[0] }}')"></div>
              <div style="--bg-image: url('{{ $exteriorGridImages[1] }}')"></div>
              <div class="bottom-wide" style="--bg-image: url('{{ $exteriorGridImages[2] }}')"></div>
            </div>
          </div>
           <div class="logo-watermark-bottom">
              <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
            </div>
      </div>
      @else
      <div class="page">
          <div class="container" style="padding: 3.70mm !important;">
            <div class="quad-grid">
              <div style="--bg-image: url('{{ $exteriorGridImages[0] ?? 'property/images/test.png' }}')"></div>
              <div style="--bg-image: url('{{ $exteriorGridImages[1] ?? 'property/images/test.png' }}')"></div>
              <div style="--bg-image: url('{{ $exteriorGridImages[2] ?? 'property/images/test.png' }}')"></div>
              <div style="--bg-image: url('{{ $exteriorGridImages[3] ?? 'property/images/test.png' }}')"></div>
            </div>

           </div>
           <div class="logo-watermark-bottom">
              <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
            </div>
      </div>
      @endif

      

  @endif

  <!-- PAGE 4: FULL BACKGROUND (exterior overflow full page) -->
  @if(!empty($exteriorExtraImage))
  <div class="page bg" style="--bg-image: url('{{ $exteriorExtraImage }}')">
    <div class="logo-watermark-bottom">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    
  </div>
  @endif

  <!-- PAGE 5: FACILITIES GALLERY -->
  @if(!empty($facilityItems))
  <div class="page">
    <div class="container" style="position: relative; z-index: 1;">
      <div class="header">
        <span class="title">FACILITIES</span>
        <img style="width: 12%" src="{{ $data['company']['logo'] ?? $data['branding']['logo_full'] }}" alt="hibarr-logo" />
      </div>

      <div class="gallery-grid">
        @foreach(array_slice($facilityItems, 0, 6) as $index => $facility)
          <div class="gallery-item">
            @if(!empty($facility['image']))
              <img src="{{ $facility['image'] }}" alt="{{ $facility['label'] ?? ('Facility ' . ($index + 1)) }}" />
            @endif
            <div class="title">
              <span>{{ $facility['label'] ?? ('Facility ' . ($index + 1)) }}</span>
            </div>
          </div>
        @endforeach
      </div>
    </div>
    
  </div>
  @endif

  <!-- PAGE — First gallery image full page (after facilities) -->
  @if(!empty($galleryImages[$galleryCursor]))
  @php
    $firstGalleryImage = $galleryImages[$galleryCursor];
    $galleryCursor++;
  @endphp
  <div class="page bg" style="--bg-image: url('{{ $firstGalleryImage }}')">
    <div style="position: absolute; top: 5%; left: 0; z-index: 10;">
        <div style="position: relative; display: inline-block; line-height: 0;">
            <img src="{{ $data['branding']['sharp_page_header'] }}" alt="page-header"
                style="height: 72px; width: auto; display: block;" />
            <span
                style="position: absolute; top: 50%; left: 25%; transform: translateY(-50%); color: #053160; font-size: 17px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; white-space: nowrap;">Restaurant</span>
        </div>
    </div>
    <div class="logo-watermark-bottom">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    
  </div>
  @endif

  <!-- PAGE(S) 6: UNIT DESCRIPTION — one page per unit style -->
  @foreach(array_slice($unitStyleList, 0, 1) as $styleLabel)
  @php
    $styleImage = $galleryImages[$galleryCursor] ?? null;
    if (!empty($styleImage)) {
      $galleryCursor++;
    }
  @endphp
  <div class="page">
    <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-left" alt="" />
    <div class="container" style="padding: 5mm; position: relative; z-index: 1;">
      <div class="row overview-layout" style="align-items: stretch;">
        <div class="col-5" style="display: flex; flex-direction: column; justify-content: center;">
          <div class="content">
            <div class="expose-title">
              <img style="width: 25%" src="{{ $data['branding']['logo_rounded'] }}" alt="rounded" />
              <div class="text blue">
                <h1 class="fw-500 rounded-text">{{ strtoupper((string) $styleLabel) }}</h1>
              </div>
            </div>

            {{-- <h1>{{ strtoupper((string) $styleLabel) }}</h1> --}}

            <p>
              {{ !empty($data['description']) ? Str::limit(strip_tags($data['description']), 300) : 'Modern property with smart layout and natural light.' }}
            </p>
          </div>
        </div>

        <div class="col-7" style="display: flex; align-items: center; padding: 10mm 0 10mm 5mm;">
          <div class="illustration" style="height: 80%; width: 100%; border-radius: 0.5rem; overflow: hidden;">
            @if(!empty($styleImage))
            <img src="{{ $styleImage }}" alt="{{ $styleLabel }}" style="width: 100%; height: 100%; object-fit: cover;" />
            @endif
          </div>
        </div>
      </div>
    </div>
    
    <div class="logo-watermark-bottom">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
   
  </div>
  @endforeach

  <!-- PAGE — Next gallery image full page -->
  @if(!empty($galleryImages[$galleryCursor]))
  @php
    $nextGalleryFull = $galleryImages[$galleryCursor];
    $galleryCursor++;
  @endphp
  <div class="page bg" style="--bg-image: url('{{ $nextGalleryFull }}')">
    <div class="logo-watermark-bottom">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    
  </div>
  @endif

  <!-- PAGE — Gallery collage page (same pattern as exterior) -->
  @php
    $remainingGallery = array_slice($galleryImages, $galleryCursor);
    $galleryGridImages = array_slice($remainingGallery, 0, 4);
  @endphp
  @if(!empty($remainingGallery))
  <div class="page">
    <div class="container" style="padding: 3.70mm !important;">
      @if(count($galleryGridImages) === 2)
        <div class="quad-grid-2">
          <div style="--bg-image: url('{{ $galleryGridImages[0] }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[1] }}')"></div>
        </div>
      @elseif(count($galleryGridImages) === 3)
        <div class="tri-grid">
          <div style="--bg-image: url('{{ $galleryGridImages[0] }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[1] }}')"></div>
          <div class="bottom-wide" style="--bg-image: url('{{ $galleryGridImages[2] }}')"></div>
        </div>
      @elseif(count($galleryGridImages) === 6)
        <div class="quad-grid-6">
          <div style="--bg-image: url('{{ $galleryGridImages[0] }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[1] }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[2] }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[3] }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[4] }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[5] }}')"></div>
        </div>
      @else
        <div class="quad-grid">
          <div style="--bg-image: url('{{ $galleryGridImages[0] ?? 'property/images/test.png' }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[1] ?? 'property/images/test.png' }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[2] ?? 'property/images/test.png' }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[3] ?? 'property/images/test.png' }}')"></div>
        </div>
      @endif

      <div class="logo-watermark-bottom">
        <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
      </div>
    </div>
    
  </div>
  @endif

  <!-- PAGE 8: UNIT LAYOUT / FLOOR PLAN -->
  <div class="page">
    <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-right" alt="" />
    <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-left" alt="" />
    <div class="container" style="position:relative; z-index:1;">
       <!-- Top row: block-title card + floor plan image -->
        <div class="unit-grid">
            <!-- Block title card — left column, full grid-row height -->
            <div class="block-title" style="position:relative;">
                <img src="{{ $data['branding']['block_title'] }}" alt="block-title"
                    style="width:100%; display:block;" />

                <div class="text">
                    <h1
                        style="font-size:42px; line-height:1.35; color:#053160; font-weight:700; text-align:center;">
                        {{ !empty($data['display_label']) ? $data['display_label'] : ($data['bedrooms'] ?? '') . ($data['bedrooms'] ? ' + ' . ($data['living_room'] ?? '1') : '') }}<br><span class="more" style="font-weight:400; font-size: 32px;">{{ !empty($data['block_name']) ? ' (' . strtoupper($data['block_name']) . ')' : '' }}</span>
                    </h1>
                </div>
            </div>
            <!-- Floor plan image — right column -->
              @if(!empty($data['assets']['floor-plan'][0]))
            <img src="{{ $data['assets']['floor-plan'][0] }}" alt="Floor plan"
                style="width:100%; height:306px; object-fit:cover; display:block;" />
            @endif
        </div>
        <!-- Bottom row: unit details centred -->
        
    </div>
   
  </div>

{{-- PAGE — Cost / Investment breakdown (DEFERRED: Requires financial_info data structure)
     TODO: Enable this page when financial data is populated in Property model
<div class="page">
    <div class="container">
        <div class="sheet">
               <!-- COST -->
          <section>
            <h2>COST</h2>

            <table>
              <tr class="sub-header">
                <td colspan="6">UNITS: 1</td>
              </tr>
              <tr>
                <th>NO</th>
                <th>TYPE</th>
                <th>FLOOR</th>
                <th>M2</th>
                <th>VIEW</th>
                <th class="right">PRICE</th>
              </tr>
              <tr>
                <td>A7-14</td>
                <td>Studio</td>
                <td>First</td>
                <td>32 + 3</td>
                <td>Green Area</td>
                <td class="right">£84,500</td>
              </tr>
              <tr class="total">
                <td colspan="5">NET PURCHASE</td>
                <td class="right">£84,500</td>
              </tr>
            </table>

            <table>
              <tr>
                <th colspan="3">ADDITIONAL COSTS UPON CONTRACT SIGNING</th>
              </tr>
              <tr>
                <td>Legal Fee</td>
                <td></td>
                <td class="right">£2,250</td>
              </tr>
              <tr>
                <td>Stamp Fees & Land Registration</td>
                <td class="center">6.5%</td>
                <td class="right">£5,493</td>
              </tr>
              <tr class="total">
                <td colspan="2">TOTAL</td>
                <td class="right">£7,743</td>
              </tr>
            </table>

            <table>
              <tr>
                <th colspan="3">ADDITIONAL COSTS UPON COMPLETION</th>
              </tr>
              <tr>
                <td>Trafo & Water Connection</td>
                <td></td>
                <td class="right">£4,000</td>
              </tr>
              <tr>
                <td>VAT, Title Deed Transfer</td>
                <td class="center">11.0%</td>
                <td class="right">£9,295</td>
              </tr>
              <tr>
                <td>Furniture</td>
                <td></td>
                <td class="right">£0</td>
              </tr>
              <tr class="total">
                <td colspan="2">TOTAL</td>
                <td class="right">£13,295</td>
              </tr>
            </table>
          </section>

          <!-- RENTAL INCOME & PAYMENT -->
          <section>
            <h2>RENTAL INCOME</h2>

            <table>
              <tr>
                <th colspan="2">ESTIMATED RENTAL INCOME p.a. gross</th>
                <th class="right">£7,605</th>
              </tr>
              <tr>
                <td colspan="2">Cost – Rental Management p.a. (30.0%)</td>
                <td class="right">£2,282</td>
              </tr>
              <tr class="total">
                <td colspan="2">Net Rental Income p.a.</td>
                <td class="right">£5,324</td>
              </tr>
              <tr class="total">
                <td colspan="2">Net Monthly Income</td>
                <td class="right">£444</td>
              </tr>
            </table>

            <div class="box">
              <table>
                <tr>
                  <th>EQUITY</th>
                  <th>BANK</th>
                </tr>
                <tr>
                  <td class="center">£42,500</td>
                  <td class="center">£0</td>
                </tr>
              </table>
            </div>

            <div class="payment">
              <table>
                <tr>
                  <th colspan="2">PAYMENT PLAN</th>
                </tr>
                <tr>
                  <td>84 × Month (Vendor)</td>
                  <td class="right">Installments: £500</td>
                </tr>
              </table>

              <div class="payment-summary">
                <div class="highlight">50% DOWN PAYMENT<br />£42,500</div>
                <div class="highlight">TOTAL INSTALLMENTS<br />£500</div>
              </div>
            </div>
          </section>
        </div>
    </div>

     <div class="logo-watermark">
        <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">07</div>
</div>
--}}


<!-- PAGE — Project location spotlight -->
@if(!empty($locationTitle) || !empty($locationDescription) || !empty($locationImage))
<div class="page">
  <div class="split-page" style="position:relative; z-index:1;">
    <div class="split-top" style="--bg-image: url('{{ $locationImage ?? $outroPrimaryImage }}')"></div>
    <div class="split-bottom">
      <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-right" alt="" />
      <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-left" alt="" />
      <div class="container">
        <p style="max-width:80%;">{!! !empty($locationDescription) ? Str::limit($locationDescription, 320) : 'Explore the surrounding neighborhood and its unique lifestyle advantages.' !!}</p>
      </div>
    </div>
    <div class="expose-title blue absolute">
      <img style="width:80%" src="{{ $data['branding']['logo_rounded'] }}" alt="rounded" />
      <div class="text blue">
        <h1 class="fw-500">{{ strtoupper($locationTitle ?? 'LOCATION') }}</h1>
      </div>
    </div>
    {{-- <div class="rock">
      <img src="{{ $locationImage ?? $outroSecondaryImage }}" alt="location" />
    </div> --}}
  </div>
 
</div>
@endif


<!-- PAGE 10: INFRASTRUCTURE / DISTANCES -->
@if(!empty($data['distances']) || !empty($locationInfrastructure) || !empty($locationAirports))
@php
  $distanceList = array_values($data['distances'] ?? []);

  // Prefer explicitly linked ProjectLocation arrays; fall back to legacy distance rows.
  $legacyInfraItems = array_values(array_filter($distanceList, fn ($item) => ($item['type'] ?? null) === 'infrastructure'));
  $legacyAirportItems = array_values(array_filter($distanceList, fn ($item) => ($item['type'] ?? null) === 'airport'));

  $infraItems = !empty($locationInfrastructure)
    ? array_slice($locationInfrastructure, 0, 4)
    : array_slice($legacyInfraItems, 0, 4);

  $airportItems = !empty($locationAirports)
    ? array_slice($locationAirports, 0, 3)
    : array_slice($legacyAirportItems, 0, 3);
@endphp
<div class="page">
  <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-left" alt="" />
  <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-right" alt="" />
  <div class="infrastructure">
    <div class="header">
      <span class="title">INFRASTRUCTURE</span>
      <span class="title end">AIRPORT</span>
    </div>
    <div class="container" style="gap: 1rem;">

      {{-- TOP ROW: first 2 infra items (left) + map & first airport item (right) --}}
      <div style="display:flex; flex:1; gap:2rem; align-items:center;">
        {{-- First half: first 2 infrastructure items --}}
        <div style="display:flex; flex:1; gap:1rem; align-items:center;">
          @foreach(array_slice($infraItems, 0, 2) as $i => $distance)
          @php $imgKey = $i; @endphp
          <div class="grid-item" style="flex:1;">
            <img src="{{ $distance['image'] ?? ($data['assets']['exterior'][$imgKey] ?? ($data['assets']['interior'][$imgKey] ?? 'property/images/test.png')) }}" alt="{{ $distance['name'] ?? '' }}" />
            <span class="infra-span">{{ $distance['name'] ?? ucwords(str_replace('_', ' ', array_keys($data['distances'])[$imgKey] ?? '')) }}</span>
            <p class="infra-p">{{ $distance['travelTimeInMin'] ?? $distance['time'] ?? $distance['distance'] ?? (is_scalar($distance) ? $distance : '') }}{{ is_numeric($distance['travelTimeInMin'] ?? $distance['time'] ?? $distance['distance'] ?? null) ? ' min' : '' }}</p>
          </div>
          @endforeach
        </div>
        {{-- Second half: map + first airport item --}}
        <div style="display:flex; flex:1; gap:1rem; align-items:center; overflow:visible;">
          <div class="airport-map" style="flex:2; align-self:stretch; margin-right:-40px;">
            <img src="{{ $data['branding']['map'] }}" alt="Map" />
          </div>
          @if(!empty($airportItems[0]))
          @php $a = $airportItems[0]; @endphp
          <div class="airport-item" style="position:relative; z-index:1;">
            <img src="{{ $a['image'] ?? ($data['assets']['exterior'][0] ?? 'property/images/test.png') }}" alt="{{ $a['name'] ?? '' }}" />
            <p>{{ strtoupper($a['name'] ?? ucwords(str_replace('_', ' ', array_keys($data['distances'])[0] ?? ''))) }}</p>
            <span>{{ $a['travelTimeInMin'] ?? $a['time'] ?? $a['distance'] ?? (is_scalar($a) ? $a : '') }}</span>
          </div>
          @endif
        </div>
      </div>

      {{-- BOTTOM ROW: next 2 infra items (left) + remaining airport items & logo (right) --}}
      <div style="display:flex; flex:1; gap:2rem; align-items:stretch;">
        {{-- First half: next 2 infrastructure items --}}
        <div style="display:flex; flex:1; gap:1rem; align-items:flex-start;">
          @foreach(array_slice($infraItems, 2, 2) as $j => $distance)
          @php $imgKey = $j + 2; @endphp
          <div class="grid-item" style="flex:1;">
            <img src="{{ $distance['image'] ?? ($data['assets']['exterior'][$imgKey] ?? ($data['assets']['interior'][$imgKey] ?? 'property/images/test.png')) }}" alt="{{ $distance['name'] ?? '' }}" />
            <span class="infra-span">{{ $distance['name'] ?? ucwords(str_replace('_', ' ', array_keys($data['distances'])[$imgKey] ?? '')) }}</span>
            <p class="infra-p">{{ $distance['travelTimeInMin'] ?? $distance['time'] ?? $distance['distance'] ?? (is_scalar($distance) ? $distance : '') }}{{ is_numeric($distance['travelTimeInMin'] ?? $distance['time'] ?? $distance['distance'] ?? null) ? ' min' : '' }}</p>
          </div>
          @endforeach
        </div>
        {{-- Second half: airport items [1] & [2] + logo --}}
        <div style="display:flex; flex:1; gap:1rem; align-items:flex-start;">
          @if(!empty($airportItems[1]))
          @php $b = $airportItems[1]; @endphp
          <div class="airport-item">
            <img src="{{ $b['image'] ?? ($data['assets']['exterior'][1] ?? 'property/images/test.png') }}" alt="{{ $b['name'] ?? '' }}" />
            <p>{{ strtoupper($b['name'] ?? ucwords(str_replace('_', ' ', array_keys($data['distances'])[1] ?? ''))) }}</p>
            <span>{{ $b['travelTimeInMin'] ?? $b['time'] ?? $b['distance'] ?? (is_scalar($b) ? $b : '') }}</span>
          </div>
          @endif
          @if(!empty($airportItems[2]))
          @php $c = $airportItems[2]; @endphp
          <div class="airport-item">
            <img src="{{ $c['image'] ?? ($data['assets']['exterior'][2] ?? 'property/images/test.png') }}" alt="{{ $c['name'] ?? '' }}" />
            <p>{{ strtoupper($c['name'] ?? ucwords(str_replace('_', ' ', array_keys($data['distances'])[2] ?? ''))) }}</p>
            <span>{{ $c['travelTimeInMin'] ?? $c['time'] ?? $c['distance'] ?? (is_scalar($c) ? $c : '') }}</span>
          </div>
          @endif
          <div class="airport-logo" style="align-self:flex-end;">
            <img src="{{ $data['branding']['logo_blue'] }}" alt="Hibarr" />
          </div>
        </div>
      </div>

    </div>
  </div>
</div>
@endif

<!-- PAGE 9: SPLIT LAYOUT WITH QUOTE -->
<div class="page">
    <div class="split-page" style="position:relative; z-index:1;">
        <div class="split-top" style="--bg-image: url('{{ $outroPrimaryImage }}')"></div>
        <div class="split-bottom">
            <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-right" alt="" />
            <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-left" alt="" />
            <div class="container">
            <div style="max-width:80%;">{!! $outroDescription !!}</div>
            </div>
        </div>
        <div class="expose-title blue absolute">
            <img style="width:80%" src="{{ $data['branding']['logo_rounded'] }}" alt="rounded" />
            <div class="text blue">
                <h1 class="fw-500">{{ strtoupper($outroTitle) }}</h1>
            </div>
        </div>
        <div class="rock">
            <img src="{{ $outroSecondaryImage }}" alt="rock" />
        </div>
    </div>
    
</div>




<!-- PAGE — Floor Plan -->
@if(!empty($data['assets']['floor-plan']))
<div class="page">
    <div class="container" style="justify-content:center;">
        <img src="{{ $data['assets']['floor-plan'][0] }}"  style="width:100%;height:auto;" alt="Floor plan" />
    </div>
   
</div>
@endif

<!-- PAGE 12: CLOSURE / CONTACT -->
<div class="page">
    <div class="bg" style="--bg-image: url('{{ $data['assets']['hero'][0] ?? 'property/images/test.png' }}'); display:flex; justify-content:flex-end; height:100%;">

        {{-- QR / CTA column bottom-left --}}
        @php
            $qrEnabled = (bool) data_get($data, 'expose_global_config.qr.enabled', false);
            $qrDataUri = data_get($data, 'expose_global_config.qr.qr_code_data_uri');
            $qrLabel   = data_get($data, 'expose_global_config.qr.label', "What Our Clients Say About Their Journey With Us!");
        @endphp
        @if($qrEnabled && !empty($qrDataUri))
        <div class="qr-cta">
            <div class="qr-column">
                <p class="qr-label">{{ $qrLabel }}</p>
                <div class="qr-box">
                    <img src="{{ $qrDataUri }}" alt="QR Code" />
                </div>
                <p class="qr-scan">SCAN HERE</p>
            </div>
            <img src="{{ $data['branding']['arrow'] ?? '' }}" alt="" style="height:151px; width:auto; display:block;" />
        </div>
        @endif

        <div class="container">
            <div class="closure" style="position:relative; overflow:hidden; z-index:0; background:rgba(255,255,255,0.82);">
                <img src="{{ $data['branding']['panther_watermark'] }}" class="panther-dual-right" alt=""
                    style="height:70%; z-index:0;" />
                <div style="position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; gap:2rem; width:100%;">
                    <div style="display:flex; flex-direction:column; align-items:center; width:100%;">
                        <img style="width:65%;" src="{{ $data['branding']['logo_blue'] }}" alt="Hibarr Logo" />
                        <div style="margin-top:16px; width:68%; height:3px; background:#053160; border-radius:1px;"></div>
                    </div>
                    <div>
                        <h1>{{ $data['agent']['name'] ?? 'Rabih Rabea' }}</h1>
                        <p>{{ $data['agent']['position'] ?? 'Real Estate Consultant' }}</p>
                    </div>
                    <div>
                        <a href="mailto:{{ $data['agent']['email'] ?? 'info@hibarr.de' }}">
                            <h2 style="text-transform:none;">{{ $data['agent']['email'] ?? 'info@hibarr.de' }}</h2>
                        </a>
                        <a href="tel:{{ str_replace([' ', '+'], '', $data['agent']['phone'] ?? '+491731009900') }}">
                            <h2 style="text-transform:none;">{{ $data['agent']['phone'] ?? '+49 173 100 99 00' }}</h2>
                        </a>
                    </div>
                    <div>
                        <a href="https://{{ $data['company']['website'] ?? 'www.hibarr.de' }}">{{ $data['company']['website'] ?? 'www.hibarr.de' }}</a>
                        <h2 style="text-transform:none;">{{ $data['company']['address'] ?? 'Sehit Mehmet Mustafa Sokak 171, 9930 Kyrenia Merkez, North Cyprus' }}</h2>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
</div>