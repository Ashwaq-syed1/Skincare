import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  Input,
  Output,
  EventEmitter,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatOptionModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FilterKey, Profile } from './types';

/**
 GENERATED VARIABLE. Do not edit manually. Use these instructions:
 go/fix-hamburger?dir=experimental/alloydb-ai-demo/vector-ui/app
*/
const NG_COMPONENT_IMPORTS: any[] = [
  CommonModule,
  MatButtonModule,
  MatFormFieldModule,
  MatIconModule,
  MatOptionModule,
  MatSelectModule,
  ReactiveFormsModule,
  MatSlideToggleModule,
  MatTooltipModule,
];

@Component({
  selector: 'app-filters',
  templateUrl: './filters.ng.html',
  styleUrls: ['./filters.scss'],
  standalone: true,
  imports: NG_COMPONENT_IMPORTS,
})
export class FiltersComponent {
  // Input stored as a signal internally so we can call it as a function

  // keep the internal signal as a Map
  private readonly _profilePresets = signal<Map<string, FilterKey>>(new Map());

  /** Accept either a Map or an array of Profile and normalize to Map internally */
  @Input()
  set profilePresets(value: Map<string, FilterKey> | ReadonlyArray<Profile> | undefined) {
    if (!value) {
      this._profilePresets.set(new Map());
      return;
    }

    if (value instanceof Map) {
      this._profilePresets.set(value);
      return;
    }

    // value is ReadonlyArray<Profile> — convert to Map
    const map = new Map<string, FilterKey>();

    for (const profile of value as ReadonlyArray<Profile>) {
      // Add skin types
      if (profile.skinTypes) {
        for (const st of profile.skinTypes) {
          const stKey = (st as any).key ?? (st as any).id ?? String(st);
          map.set(`skin:${String(stKey)}`, FilterKey.SKIN_TYPE);
        }
      }

      // Add preferences
      if (profile.preferences) {
        for (const pref of profile.preferences) {
          const prefKey = (pref as any).key ?? (pref as any).id ?? (pref as any).name ?? JSON.stringify(pref);
          map.set(`pref:${String(prefKey)}`, FilterKey.PREFERENCES);
        }
      }

      // Optional profile marker (remove if not needed)
      map.set(`profile:${profile.userId}`, FilterKey.PREFERENCES);
    }

    this._profilePresets.set(map);
  }

  get profilePresets(): Map<string, FilterKey> {
    return this._profilePresets();
  }

  @Output() readonly filtersChanged = new EventEmitter<{
    values: Map<string, FilterKey>;
    personalized: boolean;
  }>();

  protected readonly preferencesControl = new FormControl<string[]>([], { nonNullable: true });
  protected readonly skinTypeControl = new FormControl<string[]>([], { nonNullable: true });
  protected readonly secondaryCategoryControl = new FormControl<string[]>([], { nonNullable: true });
  protected readonly priceRangeControl = new FormControl<string[]>([], { nonNullable: true });
  protected readonly ratingControl = new FormControl<string[]>([], { nonNullable: true });

  // Signals derived from form controls
  protected readonly preferences = toSignal<string[]>(
    this.preferencesControl.valueChanges,
    { requireSync: false }
  );
  protected readonly skinType = toSignal<string[]>(
    this.skinTypeControl.valueChanges,
    { requireSync: false }
  );
  protected readonly secondaryCategory = toSignal<string[]>(
    this.secondaryCategoryControl.valueChanges,
    { requireSync: false }
  );
  protected readonly priceRange = toSignal<string[]>(
    this.priceRangeControl.valueChanges,
    { requireSync: false }
  );
  protected readonly rating = toSignal<string[]>(
    this.ratingControl.valueChanges,
    { requireSync: false }
  );

  protected readonly isPersonalized = signal(false);

  protected hasFilters = computed(() => {
    return this.buildFiltersMap().size > 0;
  });

  constructor() {
    this.setupFilterEffect();
  }

  private setupFilterEffect(): void {
    // Keep personalized toggle consistent with profile presets
    effect(() => {
      const isPersonalized = this.isPersonalized();
      if (!isPersonalized) return;

      const filters = this.buildFiltersMap();
      const personalizedFilters = this._profilePresets();
      for (const [key] of personalizedFilters) {
        if (!filters.has(key)) {
          this.isPersonalized.set(false);
          return;
        }
      }
    });

    // Emit whenever filters or personalization change
    effect(() => {
      this.filtersChanged.emit({
        values: this.buildFiltersMap(),
        personalized: this.isPersonalized(),
      });
    });
  }

  protected clearFilters(): void {
    this.preferencesControl.reset();
    this.skinTypeControl.reset();
    this.secondaryCategoryControl.reset();
    this.priceRangeControl.reset();
    this.ratingControl.reset();
  }

  setFilters(filters: Map<string, FilterKey>): void {
    this.setFilterValues(this.preferencesControl, filters, FilterKey.PREFERENCES);
    this.setFilterValues(this.skinTypeControl, filters, FilterKey.SKIN_TYPE);
    this.setFilterValues(this.secondaryCategoryControl, filters, FilterKey.SECONDARY_CATEGORY);
    this.setFilterValues(this.priceRangeControl, filters, FilterKey.PRICE_RANGE);
    this.setFilterValues(this.ratingControl, filters, FilterKey.RATING);
  }

  unsetFilters(filters: Map<string, FilterKey>): void {
    this.unsetFilterValues(this.preferencesControl, filters, FilterKey.PREFERENCES);
    this.unsetFilterValues(this.skinTypeControl, filters, FilterKey.SKIN_TYPE);
    this.unsetFilterValues(this.secondaryCategoryControl, filters, FilterKey.SECONDARY_CATEGORY);
    this.unsetFilterValues(this.priceRangeControl, filters, FilterKey.PRICE_RANGE);
    this.unsetFilterValues(this.ratingControl, filters, FilterKey.RATING);
  }

  private unsetFilterValues(control: FormControl<string[]>, filters: Map<string, FilterKey>, key: FilterKey): void {
    const currentValues = new Set(control.value);
    for (const [value, filterKey] of filters) {
      if (filterKey === key) {
        currentValues.delete(value);
      }
    }
    control.setValue([...currentValues]);
  }

  private setFilterValues(control: FormControl<string[]>, filters: Map<string, FilterKey>, key: FilterKey): void {
    const result = new Set<string>();
    for (const [value, filterKey] of filters) {
      if (filterKey === key) {
        result.add(value);
      }
    }
    if (result.size > 0) {
      control.setValue([...new Set([...control.value, ...result])]);
    }
  }

  protected onPersonalizedChange(event: MatSlideToggleChange): void {
    this.isPersonalized.set(event.checked);
    if (event.checked) {
      this.setFiltersFromProfile();
    }
  }

  setSkinTypes(skinTypes: string[]): void {
    const filters = new Map<string, FilterKey>();
    for (const skinType of skinTypes) {
      filters.set('skin' + skinType.toLowerCase(), FilterKey.SKIN_TYPE);
    }
    this.setFilters(filters);
  }

  unsetSkinTypes(skinTypes: string[]): void {
    const filters = new Map<string, FilterKey>();
    for (const skinType of skinTypes) {
      filters.set('skin' + skinType.toLowerCase(), FilterKey.SKIN_TYPE);
    }
    this.unsetFilters(filters);
  }

  private setFiltersFromProfile(): void {
    this.setFilters(this._profilePresets());
  }

  private buildFiltersMap(): Map<string, FilterKey> {
    const result = new Map<string, FilterKey>();
    this.addValuesToResult(this.preferences(), FilterKey.PREFERENCES, result);
    this.addValuesToResult(this.skinType(), FilterKey.SKIN_TYPE, result);
    this.addValuesToResult(this.secondaryCategory(), FilterKey.SECONDARY_CATEGORY, result);
    this.addValuesToResult(this.priceRange(), FilterKey.PRICE_RANGE, result);
    this.addValuesToResult(this.rating(), FilterKey.RATING, result);
    return result;
  }

  private addValuesToResult(values: string[] | null | undefined, key: FilterKey, result: Map<string, FilterKey>): void {
    if (!values) return;
    for (const value of values) {
      result.set(value, key);
    }
  }
}
