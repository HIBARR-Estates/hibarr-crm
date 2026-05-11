<style>
    @page {
  size: 297mm 93.79mm;
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
  width: 297mm;
  height: 93.79mm;
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

.logo-watermark {
  position: absolute;
  bottom: 20mm;
  right: 45mm;
  width: 100px;
  opacity: 0.8;
}

.logo-placeholder {
  width: 120px;
  height: 40px;
  background: #053160;
  margin-bottom: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 10px;
  letter-spacing: 2px;
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
  width: 456px;
}
.block-title img {
  position: relative;
  z-index: 1;
  width: 100%;
}
.block-title .text {
  display: flex;
  align-items: center;
  justify-content: center;
  position: absolute;
  top: 20%;
  left: 10%;
  width: 80%;
  height: 100%;
  z-index: 2;
  padding: 1rem;
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
  grid-template-rows: 1.5fr 1fr;
  gap: 10px;
  height: 100%;
  box-sizing: border-box;
}
.featured-grid > * {
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
  grid-template-rows: 1.5fr 1fr;
  gap: 10px;
  height: 100%;
  box-sizing: border-box;
}
.quad-grid > * {
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
.split-page .rock-shape {
  position: absolute;
  right: 2%;
  bottom: 33%;
  width: 264px;
  height: 319px;
  border: 4px solid white;
  overflow: hidden;
  border-radius: 84% 31% 73% 41%/49% 32% 37% 47%;
  transform: translateY(40%);
  z-index: 5;
}
.split-page .rock-shape img {
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
     object-fit: cover;
  -o-object-position: center;
     object-position: center;
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
  border: 0.0625rem solid;
  position: relative;
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
  transition: 0.3s all ease-in-out;
  height: 100%;
  width: 500px;
  height: 500px;
  transform: rotate(-45deg);
}
.overflow-illustration img {
  margin: auto;
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
     object-fit: cover;
  border-radius: 2rem;
}

.illustration {
  overflow: hidden;
  transition: 0.3s all ease-in-out;
  height: 100%;
}
.illustration img {
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
     object-fit: cover;
}

.row {
  display: flex;
  height: 100%;
  width: 100%;
}

.col-left {
  width: 60%;
  height: 100%;
  position: relative;
}

.col-right {
  width: 40%;
  height: 100%;
  padding: 15mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
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
  padding-left: 3%;
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

.text-muted {
  color: #999999;
}

.text-large {
  font-size: 14px;
}

.img-cover {
  width: 100%;
  height: 100%;
  -o-object-fit: cover;
     object-fit: cover;
  display: block;
}

.img-contain {
  width: 100%;
  height: 100%;
  -o-object-fit: contain;
     object-fit: contain;
  display: block;
}

.placeholder-img {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
}

.sheet {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  max-width: 1200px;
  margin: auto;
  background: #fff;
  padding: 24px;
  border: 1px solid #555555;
}
.sheet h2 {
  margin: 0;
  text-align: center;
  color: #053160;
  letter-spacing: 1px;
  border: none;
  font-weight: 700;
}
.sheet table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  font-size: 14px;
}
.sheet table th,
.sheet table td {
  border: 1px solid #555555;
  padding: 8px;
  text-align: left;
}
.sheet table th {
  background: #053160;
  color: #fff;
  font-weight: 600;
}
.sheet .sub-header {
  background: #f5f5f5;
  font-weight: 600;
}
.sheet .right {
  text-align: right;
}
.sheet .center {
  text-align: center;
}
.sheet .total {
  font-weight: 700;
}
.sheet .box {
  border: 1px solid #555555;
  padding: 12px;
  margin-top: 16px;
}
.sheet .payment {
  margin-top: 24px;
}
.sheet .payment-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-top: 12px;
}
.sheet .highlight {
  background: #053160;
  color: #fff;
  padding: 16px;
  font-size: 20px;
  font-weight: 700;
  text-align: center;
}

.price-tag {
  font-size: 24px;
  font-weight: 400;
  color: #053160;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 30px;
}

.meta-item {
  margin-bottom: 10px;
}

.meta-value {
  font-size: 16px;
  color: #053160;
  font-weight: 500;
}

.featured-grid {
  display: grid;
  grid-template-columns: 58.33% 41.67%;
  grid-template-rows: 1.5fr 1fr;
  gap: 10px;
  height: 100%;
  box-sizing: border-box;
}
.featured-grid .left-column {
  background-color: #3498db;
  grid-row: 1/3;
}
.featured-grid .right-top {
  background-color: #e74c3c;
}
.featured-grid .right-bottom {
  background-color: #2ecc71;
}

.closure {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  background: rgba(255, 255, 255, 0.8);
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

.fw-bold {
  font-weight: 700;
}

.infrastructure .infrastructure-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
.infrastructure .grid-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: center;
}
.infrastructure .grid-item img {
  width: 100%;
  height: auto;
  -o-object-fit: cover;
     object-fit: cover;
}
.infrastructure .grid-item span {
  background: #053160;
  color: white;
  padding: 0.125rem 0.5rem;
  text-align: center;
  border-radius: 0.5rem;
  font-size: 14px;
  font-weight: 600;
}
.infrastructure .grid-item p {
  font-size: 14px;
  font-weight: 600;
  color: #053160;
}
.infrastructure .grid-item:last-child:nth-child(odd) {
  grid-column: 1/-1;
  max-width: 50%;
  margin: 0 auto;
}/*# sourceMappingURL=style.css.map */
</style>

  @php
    $pageNumber = 1;
    $heroImages = array_values($data['assets']['hero'] ?? []);
    $coverImages = array_values($data['assets']['cover'] ?? []);
    $exteriorImages = array_values($data['assets']['exterior'] ?? []);
    $galleryImages = array_values($data['assets']['gallery'] ?? []);

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
  <div class="page bg" style="--bg-image: url('{{ $heroImages[0] ?? 'property/icons/test.png' }}')">
    <div class="container">
      <div class="logo">
        <img src="{{ $data['branding']['logo_expose'] }}" alt="hibarr-expose-logo" />
      </div>
    </div>

    <div style="position: absolute; bottom: 60mm; left: 15mm; color: white; text-shadow: 2px 2px 8px rgba(0,0,0,0.6);">
      <h1 style="color: white; font-size: 36px; margin-bottom: 8px;">{{ $data['title'] ?? $data['reference_code'] ?? '' }}</h1>
      @if(!empty($data['price']))
      <p style="color: white; font-size: 24px; font-weight: 500;">{{ $data['price'] }}</p>
      @endif
      @if(!empty($data['sale_type']))
      <p style="color: rgba(255,255,255,0.85); font-size: 16px; margin-top: 4px;">{{ ucfirst(str_replace('_', ' ', $data['sale_type'])) }}</p>
      @endif
    </div>

    @if(!empty($data['client']['name']))
    <div class="customer-name" style="position: absolute; bottom: 20mm; left: 15mm; color: white; font-size: 20px; font-weight: 500; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">
      Prepared for: {{ $data['client']['name'] }}
    </div>
    @endif
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>

  <!-- PAGE — Cover image (before property overview) -->
  @if(!empty($coverImages[0]))
  <div class="page bg" style="--bg-image: url('{{ $coverImages[0] }}')">
    <div class="logo-watermark">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>
  @endif

  <!-- PAGE 2: PROPERTY OVERVIEW -->
  <div class="page">
    <div class="container">
      <div class="row">
        <div class="col-half">
          <div class="expose-title">
            <img style="width: 25%" src="{{ $data['branding']['logo_rounded'] }}" alt="rounded" />

            <div class="text">
              <h1 style="margin-bottom: 0">PROPERTY OVERVIEW</h1>
            </div>
          </div>

          <div class="items">
            <div class="item">
              <h3 class="item-header">Location</h3>
              <div class="item-value">{{ $data['city'] ?? '—' }}{{ !empty($data['area']) ? ', ' . $data['area'] : '' }}</div>
            </div>

            <div class="item">
              <h3 class="item-header">Property Type</h3>
              <div class="item-value">{{ ucfirst(str_replace('_', ' ', $data['property_type'] ?? '—')) }}</div>
            </div>

            @if(!empty($data['price']))
            <div class="item">
              <h3 class="item-header">Price</h3>
              <div class="item-value">{{ $data['price'] }}</div>
            </div>
            @endif

            <div class="item">
              <h3 class="item-header">Living Area</h3>
              <div class="item-value">
                {{ $data['living_area_sqm'] ?? '—' }} m²
                @if(!empty($data['gross_sqm']))
                  <span style="color: #999; font-size: 14px;">({{ $data['gross_sqm'] }} m² gross)</span>
                @endif
              </div>
            </div>

            @if(!empty($data['floor_number']) || !empty($data['floors_in_building']))
            <div class="item">
              <h3 class="item-header">Floor</h3>
              <div class="item-value">
                @if(!empty($data['floor_number']) && !empty($data['floors_in_building']))
                  {{ $data['floor_number'] }} / {{ $data['floors_in_building'] }}
                @elseif(!empty($data['floor_number']))
                  {{ $data['floor_number'] }}
                @else
                  {{ $data['floors_in_building'] }} floors
                @endif
              </div>
            </div>
            @endif

            @if(!empty($data['building_age']) || !empty($data['completion_date']))
            <div class="item">
              <h3 class="item-header">{{ !empty($data['completion_date']) && ($data['construction_status'] ?? '') !== 'completed' ? 'Completion' : 'Building Age' }}</h3>
              <div class="item-value">
                @if(!empty($data['completion_date']) && ($data['construction_status'] ?? '') !== 'completed')
                  {{ $data['completion_date'] }}
                @else
                  {{ $data['building_age'] ?? 'New' }} Years
                @endif
              </div>
            </div>
            @endif

            <div class="item">
              <h3 class="item-header">Rooms</h3>
              <ul class="item-list">
                <li>{{ $data['bedrooms'] ?? '—' }} Bedrooms</li>
                <li>{{ $data['bathrooms'] ?? '—' }} Bathrooms</li>
                @if(!empty($data['rooms']))
                <li>{{ $data['rooms'] }} Total Rooms</li>
                @endif
                @if(!empty($data['living_room']))
                <li>{{ $data['living_room'] }} Living Room{{ $data['living_room'] > 1 ? 's' : '' }}</li>
                @endif
              </ul>
            </div>

            @if(!empty($data['view_types']))
            <div class="item">
              <h3 class="item-header">Views</h3>
              <div class="item-value">{{ is_array($data['view_types']) ? implode(', ', array_map(fn($v) => ucfirst(str_replace('_', ' ', $v)), $data['view_types'])) : $data['view_types'] }}</div>
            </div>
            @endif

            @if(!empty($data['furniture_status']))
            <div class="item">
              <h3 class="item-header">Furniture</h3>
              <div class="item-value">{{ $data['furniture_status'] }}</div>
            </div>
            @endif
          </div>
        </div>

        <div class="col-half" style="display: flex; justify-content: center; align-items: center">
          <div class="overflow-illustration">
            <img src="{{ $data['assets']['area'][0] ?? $heroImages[0] ?? 'property/images/test.png' }}" alt="Property illustration" />
          </div>
        </div>
      </div>
    </div>

    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>

  <!-- PAGE — First exterior image full page -->
  @if(!empty($exteriorImages[0]))
  <div class="page bg" style="--bg-image: url('{{ $exteriorImages[0] }}')">
    <div class="logo-watermark">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>
  @endif

  @php
    $remainingExterior = array_slice($exteriorImages, 1);
    $exteriorGridImages = array_slice($remainingExterior, 0, 4);
    $exteriorExtraImage = $remainingExterior[4] ?? null;
  @endphp

  <!-- PAGE — Exterior remainder page (grid/full depending on count) -->
  @if(!empty($remainingExterior))
  <div class="page">
    <div class="container">
      @if(count($exteriorGridImages) === 1)
        <div class="bg" style="--bg-image: url('{{ $exteriorGridImages[0] }}')"></div>
      @elseif(count($exteriorGridImages) === 2)
        <div class="duo-grid">
          <div style="--bg-image: url('{{ $exteriorGridImages[0] }}')"></div>
          <div style="--bg-image: url('{{ $exteriorGridImages[1] }}')"></div>
        </div>
      @elseif(count($exteriorGridImages) === 3)
        <div class="tri-grid">
          <div style="--bg-image: url('{{ $exteriorGridImages[0] }}')"></div>
          <div style="--bg-image: url('{{ $exteriorGridImages[1] }}')"></div>
          <div class="bottom-wide" style="--bg-image: url('{{ $exteriorGridImages[2] }}')"></div>
        </div>
      @else
        <div class="quad-grid">
          <div class="left-top" style="--bg-image: url('{{ $exteriorGridImages[0] ?? 'property/images/test.png' }}')"></div>
          <div class="left-bottom" style="--bg-image: url('{{ $exteriorGridImages[1] ?? 'property/images/test.png' }}')"></div>
          <div class="right-top" style="--bg-image: url('{{ $exteriorGridImages[2] ?? 'property/images/test.png' }}')"></div>
          <div class="right-bottom" style="--bg-image: url('{{ $exteriorGridImages[3] ?? 'property/images/test.png' }}')"></div>
        </div>
      @endif

      <div class="logo-watermark">
        <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
      </div>
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>
  @endif

  <!-- PAGE — Sixth exterior full screen fallback -->
  @if(!empty($exteriorExtraImage))
  <div class="page bg" style="--bg-image: url('{{ $exteriorExtraImage }}')">
    <div class="logo-watermark">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>
  @endif

  <!-- PAGE — FACILITIES / AMENITIES GALLERY -->
  @if(!empty($facilityItems))
  <div class="page">
    <div class="container">
      <div class="header">
        <span class="title">FACILITIES</span>
        <img style="width: 12%" src="{{ $data['company']['logo'] ?? $data['branding']['logo_full'] }}" alt="hibarr-logo" />
      </div>

      <div class="gallery-grid">
        @foreach(array_slice($facilityItems, 0, 6) as $index => $facility)
          <div class="gallery-item">
            <div class="placeholder-img">
              @if(!empty($facility['image']))
                <img src="{{ $facility['image'] }}" alt="facility {{ $index + 1 }}" style="width:100%;height:100%;object-fit:cover;" />
              @else
                Facility {{ $index + 1 }}
              @endif
            </div>
            <div class="title">
              <span>{{ $facility['label'] ?? ('Facility ' . ($index + 1)) }}</span>
            </div>
          </div>
        @endforeach
      </div>
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>
  @endif

  <!-- PAGE — First gallery image full page (after facilities) -->
  @if(!empty($galleryImages[$galleryCursor]))
  @php
    $firstGalleryImage = $galleryImages[$galleryCursor];
    $galleryCursor++;
  @endphp
  <div class="page bg" style="--bg-image: url('{{ $firstGalleryImage }}')">
    <div class="logo-watermark">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>
  @endif

  <!-- PAGE(S) — Unit style pages with gallery-only images -->
  @foreach($unitStyleList as $styleLabel)
  @php
    $styleImage = $galleryImages[$galleryCursor] ?? null;
    if (!empty($styleImage)) {
      $galleryCursor++;
    }
  @endphp
  <div class="page">
    <div class="container" style="padding: 5mm">
      <div class="row overview-layout">
        <div class="col-5">
          <div class="content">
            <div class="expose-title">
              <img style="width: 25%" src="{{ $data['branding']['logo_rounded'] }}" alt="rounded" />
              <div class="text blue">
                <h1 class="fw-500">{{ strtoupper((string) $styleLabel) }}</h1>
              </div>
            </div>

            <h1>{{ strtoupper((string) $styleLabel) }}</h1>

            <p>
              {{ !empty($data['description']) ? Str::limit(strip_tags($data['description']), 300) : 'Modern property with smart layout and natural light.' }}
            </p>
          </div>
        </div>

        <div class="col-7">
          <div class="illustration">
            @if(!empty($styleImage))
            <img src="{{ $styleImage }}" alt="{{ $styleLabel }}" />
            @else
            <div class="placeholder-img">Gallery Image</div>
            @endif
          </div>
        </div>
      </div>
    </div>

    <div class="logo-watermark">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>
  @endforeach

  <!-- PAGE — Next gallery image full page -->
  @if(!empty($galleryImages[$galleryCursor]))
  @php
    $nextGalleryFull = $galleryImages[$galleryCursor];
    $galleryCursor++;
  @endphp
  <div class="page bg" style="--bg-image: url('{{ $nextGalleryFull }}')">
    <div class="logo-watermark">
      <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>
  @endif

  <!-- PAGE — Gallery collage page (same pattern as exterior) -->
  @php
    $remainingGallery = array_slice($galleryImages, $galleryCursor);
    $galleryGridImages = array_slice($remainingGallery, 0, 4);
  @endphp
  @if(!empty($remainingGallery))
  <div class="page">
    <div class="container">
      @if(count($galleryGridImages) === 1)
        <div class="bg" style="--bg-image: url('{{ $galleryGridImages[0] }}')"></div>
      @elseif(count($galleryGridImages) === 2)
        <div class="duo-grid">
          <div style="--bg-image: url('{{ $galleryGridImages[0] }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[1] }}')"></div>
        </div>
      @elseif(count($galleryGridImages) === 3)
        <div class="tri-grid">
          <div style="--bg-image: url('{{ $galleryGridImages[0] }}')"></div>
          <div style="--bg-image: url('{{ $galleryGridImages[1] }}')"></div>
          <div class="bottom-wide" style="--bg-image: url('{{ $galleryGridImages[2] }}')"></div>
        </div>
      @else
        <div class="quad-grid">
          <div class="left-top" style="--bg-image: url('{{ $galleryGridImages[0] ?? 'property/images/test.png' }}')"></div>
          <div class="left-bottom" style="--bg-image: url('{{ $galleryGridImages[1] ?? 'property/images/test.png' }}')"></div>
          <div class="right-top" style="--bg-image: url('{{ $galleryGridImages[2] ?? 'property/images/test.png' }}')"></div>
          <div class="right-bottom" style="--bg-image: url('{{ $galleryGridImages[3] ?? 'property/images/test.png' }}')"></div>
        </div>
      @endif

      <div class="logo-watermark">
        <img src="{{ $data['branding']['logo_white'] }}" alt="hibarr-logo" />
      </div>
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
  </div>
  @endif

  <!-- PAGE: Unit Layout -->
  <div class="page">
    <div class="container">
    <div class="row">
      <div class="col-4">
      <div class="">
        <div class="block-title">
        <img
          style="width: 80%"
          src="{{ $data['branding']['block_title'] }}"
          alt="rounded"
        />

        <div class="text">
          <h1>{{ $data['bedrooms'] ?? '' }}{{ $data['bedrooms'] ? ' + ' . ($data['living_room'] ?? '1') : '' }} {{ strtoupper(is_array($data['unit_style'] ?? null) ? implode(' / ', $data['unit_style']) : ($data['unit_style'] ?? 'UNIT')) }} <span class="more">{{ !empty($data['block_name']) ? '(' . strtoupper($data['block_name']) . ')' : '' }}</span></h1>
        </div>
        </div>

        @if(!empty($data['unit_number']))
        <div style="margin-top: 1rem; padding-left: 10px;">
          <h3 style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Unit Number</h3>
          <p style="color: #053160; font-size: 18px; font-weight: 600;">{{ $data['unit_number'] }}</p>
        </div>
        @endif

        @if(!empty($data['living_area_sqm']) || !empty($data['gross_sqm']))
        <div style="margin-top: 1rem; padding-left: 10px;">
          <h3 style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Area</h3>
          <p style="color: #053160; font-size: 18px; font-weight: 600;">
            {{ $data['living_area_sqm'] ?? '—' }} m²
            @if(!empty($data['gross_sqm']))
              <span style="font-weight: 400; font-size: 14px; color: #888;">({{ $data['gross_sqm'] }} m² gross)</span>
            @endif
          </p>
        </div>
        @endif

        @if(!empty($data['balcony_count']))
        <div style="margin-top: 1rem; padding-left: 10px;">
          <h3 style="color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Balcony</h3>
          <p style="color: #053160; font-size: 18px; font-weight: 600;">
            {{ $data['balcony_count'] }}{{ !empty($data['balcony_net_sqm']) ? ' (' . $data['balcony_net_sqm'] . ' m²)' : '' }}
          </p>
        </div>
        @endif
      </div>
      </div>

      <div class="col-8">
      <div class="content flex-center">
        @if(!empty($data['assets']['floor-plan'][0]))
          <div class="illustration" style="width: 90%; height: 100%; display: flex; align-items: center; justify-content: center;">
            <img src="{{ $data['assets']['floor-plan'][0] }}" alt="Floor plan" style="max-height: 100%; max-width: 100%; object-fit: contain;" />
          </div>
        @elseif(!empty($data['assets']['interior'][0]))
          <div class="illustration" style="width: 90%; height: 100%;">
            <img src="{{ $data['assets']['interior'][0] }}" alt="Interior" />
          </div>
        @else
          <div class="placeholder-img" style="width: 90%; height: 200px">
            Floor Plan
          </div>
        @endif
      </div>
      </div>
    </div>
    </div>

    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
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

<!-- PAGE — Split layout with quote -->
<div class="page">
    <div class="split-page">
    <div class="split-top" style="--bg-image: url('{{ $outroPrimaryImage }}')"></div>
        <div class="split-bottom">
            <div class="container">
                <p>
          {{ $outroDescription }}
                </p>
            </div>
        </div>
        <div class="expose-title blue absolute">
            <img style="width: 80%" src="{{ $data['branding']['logo_rounded'] }}" alt="rounded" />
            <div class="text blue">
        <h1 class="fw-500">{{ strtoupper($outroTitle) }}</h1>
            </div>
        </div>
        <div class="rock-shape">
      <img src="{{ $outroSecondaryImage }}" alt="rock" />
        </div>
    </div>
  <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
</div>

<!-- PAGE — Project location spotlight -->
@if(!empty($locationTitle) || !empty($locationDescription) || !empty($locationImage))
<div class="page">
  <div class="split-page">
    <div class="split-top" style="--bg-image: url('{{ $locationImage ?? $outroPrimaryImage }}')"></div>
    <div class="split-bottom">
      <div class="container">
        <p>
          {{ !empty($locationDescription) ? Str::limit(strip_tags($locationDescription), 320) : 'Explore the surrounding neighborhood and its unique lifestyle advantages.' }}
        </p>
      </div>
    </div>
    <div class="expose-title blue absolute">
      <img style="width: 80%" src="{{ $data['branding']['logo_rounded'] }}" alt="rounded" />
      <div class="text blue">
        <h1 class="fw-500">{{ strtoupper($locationTitle ?? 'LOCATION') }}</h1>
      </div>
    </div>
    <div class="rock-shape">
      <img src="{{ $locationImage ?? $outroSecondaryImage }}" alt="location" />
    </div>
  </div>
  <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE — Infrastructure / Distances -->
@if(!empty($data['distances']))
<div class="page">
    <div class="infrastructure">
        <div class="header">
            <span class="title">INFRASTRUCTURE</span>
            <span class="title end">DISTANCES</span>
        </div>

        <div class="container">
            <div class="row">
                <div class="col-5">
                    <div class="infrastructure-grid">
                        @foreach($data['distances'] as $key => $distance)
                            @if($loop->index < 6)
                            <div class="grid-item">
                                <img src="{{ $data['assets']['exterior'][$loop->index] ?? 'property/images/test.png' }}" alt="{{ $distance['name'] ?? $key }}">
                                <span>{{ $distance['name'] ?? ucwords(str_replace('_', ' ', $key)) }}</span>
                                <p>{{ $distance['time'] ?? $distance['distance'] ?? $distance }} {{ is_numeric($distance['time'] ?? $distance['distance'] ?? $distance) ? 'min' : '' }}</p>
                            </div>
                            @endif
                        @endforeach
                    </div>
                </div>
                <div class="col-7"></div>
            </div>
        </div>
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE — Floor Plan -->
@if(!empty($data['assets']['floor-plan']))
<div class="page">
    <div class="container">
        <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 20px;">
            <img src="{{ $data['assets']['floor-plan'][0] }}" style="max-height: 150mm; width: auto;" alt="Floor plan" />
        </div>
    </div>
    <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
</div>
@endif

<!-- PAGE — Closure / Contact -->
<div class="page">
    <div class="bg" style="--bg-image: url('{{ $data['assets']['hero'][0] ?? 'property/images/test.png' }}'); display: flex; justify-content: flex-end; height: 100%;">
        <div class="container">
            <div class="closure">
                <img style="width: 65%" src="{{ $data['company']['logo'] }}" alt="Hibarr Logo" />

                <div>
                    <h1>{{ $data['agent']['name'] ?? 'Rabih Rabea' }}</h1>
                    <p>{{ $data['agent']['position'] ?? 'Real Estate Consultant' }}</p>
                </div>

                <div>
                    <a href="mailto:{{ $data['agent']['email'] ?? 'info@hibarr.de' }}"><h2>{{ $data['agent']['email'] ?? 'info@hibarr.de' }}</h2></a>
                    <a href="tel:{{ str_replace([' ','+'], '', $data['agent']['phone'] ?? '+491731009900') }}"><h2>{{ $data['agent']['phone'] ?? '+49 173 100 99 00' }}</h2></a>
                </div>

                <div>
                    <a href="https://{{ $data['company']['website'] ?? 'www.hibarr.de' }}">{{ $data['company']['website'] ?? 'www.hibarr.de' }}</a>
                    <h2>{{ $data['company']['address'] ?? 'Sehit Mehmet Mustafa Sokak 171, 9930 Kyrenia Merkez, North Cyprus' }}</h2>
                </div>
{{-- 
                @if(($outroConfig['enabled'] ?? false) || ($qrConfig['enabled'] ?? false))
                  <div style="margin-top: 18px; background: rgba(255, 255, 255, 0.92); border-radius: 14px; padding: 14px; max-width: 560px; color: #053160;">
                    @if($outroConfig['enabled'] ?? false)
                      @if(!empty($outroConfig['title']))
                        <h2 style="margin: 0 0 8px 0; font-size: 22px; line-height: 1.2; color: #053160;">{{ $outroConfig['title'] }}</h2>
                      @endif

                      @if(!empty($outroConfig['description']))
                        <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 1.45; color: #053160;">{{ $outroConfig['description'] }}</p>
                      @endif

                      @if(!empty($outroConfig['primary_image_url']) || !empty($outroConfig['secondary_image_url']))
                        <div style="display: flex; gap: 8px; align-items: flex-start; margin-top: 10px;">
                          @if(!empty($outroConfig['primary_image_url']))
                            <img src="{{ $outroConfig['primary_image_url'] }}" alt="outro-primary" style="width: 58%; max-height: 110px; object-fit: cover; border-radius: 8px;" />
                          @endif
                          @if(!empty($outroConfig['secondary_image_url']))
                            <img src="{{ $outroConfig['secondary_image_url'] }}" alt="outro-secondary" style="width: 42%; max-height: 110px; object-fit: cover; border-radius: 8px;" />
                          @endif
                        </div>
                      @endif
                    @endif

                    @if(($qrConfig['enabled'] ?? false) && !empty($qrConfig['qr_code_data_uri']))
                      <div style="margin-top: 12px; display: flex; align-items: center; gap: 12px;">
                        <img src="{{ $qrConfig['qr_code_data_uri'] }}" alt="Expose QR Code" style="width: 84px; height: 84px;" />
                        <div style="font-size: 12px; line-height: 1.3; color: #053160; max-width: 420px; word-break: break-all;">
                          <strong>Scan for more details</strong><br>
                          {{ $qrConfig['link'] ?? '' }}
                        </div>
                      </div>
                    @endif
                  </div>
                @endif --}}
            </div>
        </div>
    </div>
        <div class="page-num">{{ str_pad($pageNumber++, 2, '0', STR_PAD_LEFT) }}</div>
</div>