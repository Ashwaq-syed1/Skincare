/**
 * Updated App component with global styles and webcam lifecycle wiring.
 */

import { OverlayModule } from '@angular/cdk/overlay';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  ElementRef,
  inject,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  Inject,
  PLATFORM_ID,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';

import { Subscription } from 'rxjs';

import { ChatMessageComponent } from './chat-message.component';
import { ChatComponent } from './chat.component';
import { LABELS_BY_FILTER_VALUE, STATIC_FILE_PATH } from './constants';
import { FiltersComponent } from './filters';
import { AnalysisResult, FilterKey, Filters, Profile, WindowWithEnv } from './types';

/* ---------- helper types and constants (unchanged) ---------- */

interface HttpResponse {
  a: ResponsePayload;
}

interface ResponsePayload {
  rows: Row[];
}

interface Row {
  product_id: string;
  product_name: string;
  skin_type: string;
  review_text: string;
  price_usd: number;
  works_for_oily_skin: boolean;
  cruelty_free: boolean;
  is_vegan: boolean;
  reviews: number;
  rating: number;
}

const DEFAULT_QUERY = 'skincare products';

const PHOTO_1X1_TRANSPARENT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const SKIN_SAMPLES = [
  'https://storage.googleapis.com/alloydb-ai-demo/ac1482625702b403bc3a7976fcdb2d1e2d4c3e24.png',
  'https://storage.googleapis.com/alloydb-ai-demo/4aadff4011d60288a6674702411eb18d3c689b20.png',
  'https://storage.googleapis.com/alloydb-ai-demo/59c944f031113cbe6244ba81de5c86ca19bda1fd.png',
  'https://storage.googleapis.com/alloydb-ai-demo/4a2a4bd6bec597c34898f27c4eaabdd8264bb0a8.png',
  'https://storage.googleapis.com/alloydb-ai-demo/a0cf2aa61303cedebcf5cbea40c18135516fae84.png',
];

const PROFILES: readonly Profile[] = Object.freeze([
  {
    imageUrl:
      'https://lh3.googleusercontent.com/a-/ALV-UjUObywRl3wcRXwsiODO5tJ9HQVSU71H1djHkJTdyd_3vh02B-61=s600-p',
    name: 'Tabatha (Tabby) Lewis-Simó',
    preferences: [{ typ: 'prefvegan', icon: { name: 'psychiatry', tooltip: 'Vegan friendly' } }],
    skinTypes: [{ typ: 'skinoily', icon: { name: 'water_drop', tooltip: 'Works for oily skin' } }],
    userId: '123',
  },
  {
    imageUrl:
      'https://lh3.googleusercontent.com/a-/ALV-UjX1gA32xCT-WvliQZtS7C_oSBdsIXKvPy9mXEp0LDug35xr0vnt=s600-p',
    name: 'Gabe Weiss',
    preferences: [{ typ: 'prefvegan', icon: { name: 'psychiatry', tooltip: 'Vegan friendly' } }],
    skinTypes: [{ typ: 'skinoily', icon: { name: 'water_drop', tooltip: 'Works for oily skin' } }],
    userId: '124',
  },
]);

/* ---------- component ---------- */

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatInputModule,
    OverlayModule,
    RouterModule,
    ChatMessageComponent,
    ChatComponent,
    FiltersComponent,
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  changeDetection: ChangeDetectionStrategy.Default,
  encapsulation: ViewEncapsulation.None, // <-- make SCSS global so classes apply everywhere
})
export class App implements OnInit, OnDestroy {
  // DI
  private readonly http = inject(HttpClient);

  // PLATFORM_ID to detect browser vs server
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    const iconRegistry = inject(MatIconRegistry);
    iconRegistry.setDefaultFontSetClass('google-symbols');
    // initialize skinSamples from constant
    this.skinSamples = SKIN_SAMPLES.map((src) => ({ src, isSelected: false }));
  }

  // Template refs
  @ViewChild('filtersTemplate', { read: ElementRef, static: false })
  private readonly filtersTemplate?: ElementRef;

  @ViewChild('analyzeBackdrop', { read: ElementRef, static: false })
  private readonly analyzeBackdrop?: ElementRef;

  @ViewChild('analyzeVideo', { read: ElementRef, static: false })
  private readonly analyzeVideo?: ElementRef;

  @ViewChild(FiltersComponent, { read: FiltersComponent, static: false })
  private readonly filtersComponent?: FiltersComponent;

  // Input profile (optional)
  @Input() profile?: Profile;

  // UI / data properties
  readonly logoUrl = `${STATIC_FILE_PATH}logo.svg`;

  query = '';
  response: Array<any> | undefined = [];
  appliedQuery = '';
  isLoading = false;

  filters: Filters = { values: new Map<string, FilterKey>(), personalized: false };

  // Menu state
  menuOpen = false;
  // initialize safely; will be set in ngOnInit if running in browser
  menuProfileUserId = '';
  sessionId = Math.floor(Math.random() * 1e15).toString();

  // Analysis state
  isAnalyzing = false;
  webcamError = '';
  streamPromise: Promise<MediaStream | null> | null = null;
  webshotUrl = PHOTO_1X1_TRANSPARENT;
  private analysisSubscription: Subscription | null = null;
  isWaitingForAnalysis = false;
  analysisResult: AnalysisResult | null = null;

  // sample selection
  private selectedSampleIndex = -1;
  skinSamples: Array<{ src: string; isSelected: boolean }> = [];

  // Derived filter banner arrays (optional; update from FiltersComponent if available)
  skinTypeFilters: string[] = [];
  preferenceFilters: string[] = [];

  ngOnInit(): void {
    this.updateSkinSamplesSelection();

    // Browser-only initialization: read runtime ENV if available
    if (isPlatformBrowser(this.platformId)) {
      try {
        const win = window as unknown as WindowWithEnv;
        this.menuProfileUserId = win?.ENV?.userId ?? '';
      } catch {
        this.menuProfileUserId = '';
      }
    }
  }

  ngOnDestroy(): void {
    this.analysisSubscription?.unsubscribe();
    // ensure webcam is stopped when component is destroyed
    if (isPlatformBrowser(this.platformId)) {
      const videoEl = this.analyzeVideo?.nativeElement as HTMLVideoElement | null;
      stopWebcam(this.streamPromise ?? Promise.resolve(null), videoEl);
    }
  }

  // Expose profiles as readonly to avoid mutable/readonly mismatch
  get profilePresetsList(): ReadonlyArray<Profile> {
    return PROFILES;
  }

  // -------------------------
  // Menu and profile methods
  // -------------------------
  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  switchProfile(): void {
    this.closeMenu();
  }

  closeMenu(event?: KeyboardEvent): void {
    if (!event || event.key === 'Escape') {
      this.menuOpen = false;
    }
  }

  // -------------------------
  // Analysis / webcam / UI actions
  // -------------------------
  openAnalyzeDialog(): void {
    this.isAnalyzing = true;
  }

  analyzeBackdropClicked(event: MouseEvent): void {
    if (event.target === this.analyzeBackdrop?.nativeElement) {
      this.isAnalyzing = false;
      // stop webcam when closing the dialog
      if (isPlatformBrowser(this.platformId)) {
        const videoEl = this.analyzeVideo?.nativeElement as HTMLVideoElement | null;
        stopWebcam(this.streamPromise ?? Promise.resolve(null), videoEl);
        this.streamPromise = null;
      }
    }
  }

  async onWebcamRequested(request: Promise<MediaStream | null>): Promise<void> {
    this.webcamError = '';
    let stream: MediaStream | null = null;
    try {
      stream = await request;
    } catch (err) {
      console.error('Webcam request failed', err);
    }
    if (!stream) {
      this.webcamError = 'Failed to access webcam';
      return;
    }
    const videoEl = this.analyzeVideo?.nativeElement as HTMLVideoElement | undefined;
    if (videoEl) {
      videoEl.srcObject = stream;
      try {
        await videoEl.play();
      } catch {
        // ignore play errors
      }
    }
  }

  cancel(): void {
    this.analysisSubscription?.unsubscribe();
    this.webshotUrl = PHOTO_1X1_TRANSPARENT;
    this.selectedSampleIndex = -1;
    this.isWaitingForAnalysis = false;
    this.isAnalyzing = false;
    this.updateSkinSamplesSelection();

    // stop webcam if running
    if (isPlatformBrowser(this.platformId)) {
      const videoEl = this.analyzeVideo?.nativeElement as HTMLVideoElement | null;
      stopWebcam(this.streamPromise ?? Promise.resolve(null), videoEl);
      this.streamPromise = null;
    }
  }

  openCamera(force?: boolean): void {
    if (force) {
      this.selectedSampleIndex = 0;
      setTimeout(() => {
        this.selectedSampleIndex = -1;
        this.updateSkinSamplesSelection();
      }, 0);
      return;
    }

    // open camera mode
    this.selectedSampleIndex = 0;
    this.updateSkinSamplesSelection();

    // start webcam only in browser and after view has updated
    if (!isPlatformBrowser(this.platformId)) return;

    // schedule start so the video element exists in the DOM
    setTimeout(() => {
      try {
        const videoEl = this.analyzeVideo?.nativeElement as HTMLVideoElement | undefined;
        if (!videoEl) return;
        // store the promise so we can stop it later
        this.streamPromise = startWebcam(videoEl);
        // also wire up to onWebcamRequested for consistent handling
        this.onWebcamRequested(this.streamPromise);
      } catch (err) {
        console.error('Failed to start webcam', err);
      }
    }, 0);
  }

  takeScreenshot(): void {
    const videoEl = this.analyzeVideo?.nativeElement as HTMLVideoElement | undefined;
    if (!videoEl) return;

    // document is browser-only; guard to be safe
    if (!isPlatformBrowser(this.platformId)) return;

    const canvas = document.createElement('canvas');
    const imageDataURL = takeScreenshot(videoEl, canvas);
    this.webshotUrl = imageDataURL;
    this.selectedSampleIndex = 0;
    this.updateSkinSamplesSelection();
  }

  async uploadPhoto(): Promise<void> {
    this.isWaitingForAnalysis = true;
    const b64 = await this.base64SelectedPhoto();
    if (!b64) {
      this.isWaitingForAnalysis = false;
      return;
    }

    // Only read runtime ENV in browser
    let url = '';
    if (isPlatformBrowser(this.platformId)) {
      try {
        const win = window as unknown as WindowWithEnv;
        url = win?.ENV?.magicApiUrl ?? '';
      } catch {
        url = '';
      }
    }

    this.analysisSubscription = this.http
      .post<any>(url, {
        query: b64,
        sessionId: this.sessionId,
        userId: this.menuProfileUserId,
      })
      .subscribe(
        (result: any) => {
          const analysisResult: AnalysisResult = {
            ...result,
            image: `data:image/png;base64,${b64}`,
          } as AnalysisResult;

          if (analysisResult.status === 'success') {
            this.isAnalyzing = false;
            this.webshotUrl = PHOTO_1X1_TRANSPARENT;
            this.selectedSampleIndex = -1;
            this.updateSkinSamplesSelection();

            // stop webcam if it was running
            if (isPlatformBrowser(this.platformId)) {
              const videoEl = this.analyzeVideo?.nativeElement as HTMLVideoElement | null;
              stopWebcam(this.streamPromise ?? Promise.resolve(null), videoEl);
              this.streamPromise = null;
            }
          }

          this.isWaitingForAnalysis = false;

          if (analysisResult.status !== 'success') {
            this.analysisResult = null;
            return;
          }

          this.analysisResult = analysisResult;

          if (analysisResult.skinType) {
            this.filtersComponent?.setSkinTypes([analysisResult.skinType]);
          }
          if (analysisResult.productSearch) {
            this.query = analysisResult.productSearch;
            this.search(this.filters);
          }
        },
        () => {
          this.isWaitingForAnalysis = false;
        }
      );
  }

  closeAnalysis(): void {
    const analysisResult = this.analysisResult;
    this.analysisResult = null;
    if (!analysisResult) return;
    if (analysisResult.skinType) {
      this.filtersComponent?.unsetSkinTypes([analysisResult.skinType]);
    }
    if (analysisResult.productSearch) {
      this.query = '';
      this.search(this.filters);
    }

    // stop webcam when closing analysis
    if (isPlatformBrowser(this.platformId)) {
      const videoEl = this.analyzeVideo?.nativeElement as HTMLVideoElement | null;
      stopWebcam(this.streamPromise ?? Promise.resolve(null), videoEl);
      this.streamPromise = null;
    }
  }

  // -------------------------
  // Search and helpers
  // -------------------------
  search(filters: Filters): void {
    const appliedQuery = this.query;
    this.response = undefined;
    this.isLoading = true;
    const query = appliedQuery || DEFAULT_QUERY;

    const filterParams = Array.from(filters.values.entries())
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    // Only read runtime ENV in browser
    let baseUrl = '';
    if (isPlatformBrowser(this.platformId)) {
      try {
        const win = window as unknown as WindowWithEnv;
        baseUrl = win?.ENV?.dataApiUrl ?? '';
      } catch {
        baseUrl = '';
      }
    }

    const url =
      `${baseUrl}?query=${encodeURIComponent(query)}&personalized=${filters.personalized ? 'true' : 'false'}` +
      (filterParams ? `&${filterParams}` : '');

    this.http.get<any>(url).subscribe(
      (response) => {
        if (response) {
          this.appliedQuery = appliedQuery;
          const a = (response as HttpResponse).a;
          if (a && a.rows) {
            this.response = a.rows.map((row) => ({ ...row, price_usd: Math.round(row.price_usd) }));
          } else {
            this.response = [];
          }
        }
        this.isLoading = false;
      },
      () => {
        this.isLoading = false;
      }
    );
  }

  starIcons(rating: number): Array<{ name: string; className: string }> {
    if (rating > 5) rating = 5;
    if (rating < 0) rating = 0;
    const margin = 0.2;
    return Array.from({ length: 5 }, (_, i) => {
      if (rating > i + margin && rating <= i + 1 - margin) {
        return { name: 'star_half', className: 'product-star-half' };
      } else if (rating > i + margin) {
        return { name: 'star', className: 'product-star-full' };
      } else {
        return { name: 'star', className: 'product-star-empty' };
      }
    });
  }

  filterLabel(filter: string): string {
    return LABELS_BY_FILTER_VALUE.get(filter) ?? filter;
  }

  // -------------------------
  // Utility / selection helpers
  // -------------------------
  private updateSkinSamplesSelection(): void {
    this.skinSamples = SKIN_SAMPLES.map((src, index) => ({
      src,
      isSelected: index === this.selectedSampleIndex - 1,
    }));
  }

  selectSamplePhoto(index: number): void {
    this.selectedSampleIndex = index + 1;
    this.updateSkinSamplesSelection();
  }

  get selectedPhotoUrl(): string {
    if (this.selectedSampleIndex === -1) return PHOTO_1X1_TRANSPARENT;
    if (this.selectedSampleIndex === 0) return this.webshotUrl;
    return this.skinSamples[this.selectedSampleIndex - 1]?.src ?? PHOTO_1X1_TRANSPARENT;
  }

  private async base64SelectedPhoto(): Promise<string | null> {
    const selected = this.selectedPhotoUrl;
    if (!selected) return null;

    // If running on server, bail out early
    if (!isPlatformBrowser(this.platformId)) return null;

    if (selected.startsWith('data:image')) {
      return toBase64(selected);
    }
    try {
      const dataUrl = await toDataUrl(selected);
      return toBase64(dataUrl);
    } catch {
      return null;
    }
  }

  // -------------------------
  // Convenience getters used by template
  // -------------------------
  get isCameraOpen(): boolean {
    return this.selectedSampleIndex === 0;
  }

  get isWebshotOpen(): boolean {
    return this.selectedSampleIndex === 0 && !!this.webshotUrl && this.webshotUrl !== PHOTO_1X1_TRANSPARENT;
  }

  get hasFilterBanners(): boolean {
    return (this.skinTypeFilters && this.skinTypeFilters.length > 0) || (this.preferenceFilters && this.preferenceFilters.length > 0);
  }

  // Called when FiltersComponent emits changes
  onFiltersChanged(filters: Filters): void {
    this.filters = filters;
    this.search(this.filters);
  }
}

/* ---------- top-level helper functions (browser-only behavior guarded at call sites) ---------- */

async function startWebcam(videoEl: HTMLVideoElement): Promise<MediaStream | null> {
  try {
    // navigator.mediaDevices is browser-only; callers must ensure isPlatformBrowser before calling
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1600 }, height: { ideal: 900 } },
    });
    videoEl.srcObject = stream;
    await videoEl.play();
    return stream;
  } catch (err) {
    console.error('Error accessing webcam:', err);
    return null;
  }
}

async function stopWebcam(streamPromise: Promise<MediaStream | null>, videoEl: HTMLVideoElement | null): Promise<void> {
  const stream = await streamPromise;
  if (!stream) return;
  const tracks = stream.getTracks();
  for (const track of tracks) track.stop();
  if (videoEl) videoEl.srcObject = null;
}

function takeScreenshot(videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement): string {
  if (videoEl.readyState !== videoEl.HAVE_ENOUGH_DATA) return PHOTO_1X1_TRANSPARENT;
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  const context = canvasEl.getContext('2d');
  if (!context) return PHOTO_1X1_TRANSPARENT;
  context.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  return canvasEl.toDataURL('image/png');
}

function toBase64(url: string): string {
  return url.split('data:image/png;base64,')[1] ?? '';
}

async function toDataUrl(url: string): Promise<string> {
  // This function uses Image and document; callers must ensure they run in browser
  const image = new Image();
  await new Promise<void>((resolve) => {
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.crossOrigin = 'anonymous';
    image.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = image.width || 1;
  canvas.height = image.height || 1;
  const context = canvas.getContext('2d');
  if (!context) return PHOTO_1X1_TRANSPARENT;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
