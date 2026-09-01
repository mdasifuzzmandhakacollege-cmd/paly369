import {
  parsePhoneNumberFromString,
  AsYouType,
  isValidPhoneNumber,
  getCountryCallingCode,
  getCountries,
  CountryCode
} from 'libphonenumber-js';

export interface CountryInfo {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
  priority?: number;
}

/**
 * Convert ISO Alpha-2 country code to Unicode Flag Emoji
 */
export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const upper = countryCode.toUpperCase();
  // ASCII 'A' is 65 -> Regional Indicator Symbol Letter A is 127462 (127397 + 65)
  const codePoints = upper
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Resolve localized English display name for ISO Alpha-2 country code
 */
const regionDisplayNames =
  typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

export function getCountryDisplayName(countryCode: string): string {
  if (!countryCode) return '';
  const upper = countryCode.toUpperCase();
  if (regionDisplayNames) {
    try {
      const name = regionDisplayNames.of(upper);
      if (name) return name;
    } catch {
      // Fall through to fallback
    }
  }
  return upper;
}

/**
 * Dynamically generate the COMPLETE country directory from libphonenumber-js.
 * Strictly avoids manual/partial country lists.
 */
export function generateAllCountries(): CountryInfo[] {
  const countryCodes = getCountries();
  const list: CountryInfo[] = [];

  for (const code of countryCodes) {
    try {
      const callingCode = getCountryCallingCode(code);
      const dialCode = `+${callingCode}`;
      const name = getCountryDisplayName(code);
      const flag = getCountryFlag(code);

      list.push({
        code,
        name,
        dialCode,
        flag
      });
    } catch {
      // Skip codes that do not have calling codes in libphonenumber-js
    }
  }

  // Sort alphabetically by English display name
  list.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return list;
}

/**
 * The complete, dynamic international countries list generated from libphonenumber-js.
 */
export const INTERNATIONAL_COUNTRIES: CountryInfo[] = generateAllCountries();

/**
 * Detect client country from browser/device locale (if available)
 */
export function detectBrowserCountryCode(): CountryCode | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }
  try {
    const languages: readonly string[] =
      navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language];

    for (const lang of languages) {
      if (!lang) continue;
      const parts = lang.split(/[-_]/);
      if (parts.length >= 2) {
        const potentialRegion = parts[parts.length - 1].toUpperCase();
        if (potentialRegion.length === 2) {
          const match = INTERNATIONAL_COUNTRIES.find((c) => c.code === potentialRegion);
          if (match) return match.code;
        }
      }
    }

    const intlLocale = Intl?.DateTimeFormat?.().resolvedOptions()?.locale;
    if (intlLocale) {
      const parts = intlLocale.split(/[-_]/);
      if (parts.length >= 2) {
        const potentialRegion = parts[parts.length - 1].toUpperCase();
        if (potentialRegion.length === 2) {
          const match = INTERNATIONAL_COUNTRIES.find((c) => c.code === potentialRegion);
          if (match) return match.code;
        }
      }
    }
  } catch {
    // Graceful fallback on detection error
  }
  return null;
}

/**
 * Look up country info by ISO Alpha-2 code from the dynamic international directory
 */
export function getCountryByCode(code?: string | null): CountryInfo | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  const found = INTERNATIONAL_COUNTRIES.find((c) => c.code === upper);
  if (found) return found;

  try {
    const callingCode = getCountryCallingCode(upper as CountryCode);
    return {
      code: upper as CountryCode,
      name: getCountryDisplayName(upper),
      dialCode: `+${callingCode}`,
      flag: getCountryFlag(upper)
    };
  } catch {
    return null;
  }
}

/**
 * Detect country directly from full international phone number (+E.164)
 */
export function detectCountryFromPhoneNumber(input: string): CountryInfo | null {
  if (!input || !input.trim().startsWith('+')) return null;
  const clean = input.trim();
  try {
    const parsed = parsePhoneNumberFromString(clean);
    if (parsed && parsed.country) {
      return getCountryByCode(parsed.country);
    }
    const asYouType = new AsYouType();
    asYouType.input(clean);
    const country = asYouType.getCountry();
    if (country) {
      return getCountryByCode(country);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Validates and normalizes international phone number using libphonenumber-js.
 * Strictly adheres to canonical E.164 standard.
 * 
 * - If input starts with '+', parses directly and auto-detects country.
 * - If national number is entered, requires defaultCountry context.
 * - Does not force Bangladesh (+880) as hardcoded fallback.
 */
export function validateAndNormalizePhoneNumber(
  input: string,
  defaultCountry?: CountryCode | null
): {
  isValid: boolean;
  e164: string | null;
  internationalFormatted: string | null;
  nationalFormatted: string | null;
  countryCode: CountryCode | null;
  callingCode: string | null;
  error: string | null;
} {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      e164: null,
      internationalFormatted: null,
      nationalFormatted: null,
      countryCode: null,
      callingCode: null,
      error: 'Phone number is required.'
    };
  }

  const cleanInput = input.trim();
  const isExplicitInternational = cleanInput.startsWith('+');

  try {
    // If no defaultCountry is provided and number doesn't start with +, require country selection
    if (!isExplicitInternational && !defaultCountry) {
      return {
        isValid: false,
        e164: null,
        internationalFormatted: null,
        nationalFormatted: null,
        countryCode: null,
        callingCode: null,
        error: 'Please select a country code or enter number with international prefix (+).'
      };
    }

    const phoneNumber = isExplicitInternational
      ? parsePhoneNumberFromString(cleanInput)
      : parsePhoneNumberFromString(cleanInput, defaultCountry || undefined);

    if (!phoneNumber) {
      return {
        isValid: false,
        e164: null,
        internationalFormatted: null,
        nationalFormatted: null,
        countryCode: null,
        callingCode: null,
        error: 'Please enter a valid international mobile phone number.'
      };
    }

    const isValid = phoneNumber.isValid();
    if (!isValid) {
      return {
        isValid: false,
        e164: null,
        internationalFormatted: phoneNumber.formatInternational() || null,
        nationalFormatted: phoneNumber.formatNational() || null,
        countryCode: (phoneNumber.country as CountryCode) || defaultCountry || null,
        callingCode: phoneNumber.countryCallingCode ? `+${phoneNumber.countryCallingCode}` : null,
        error: 'Invalid phone number format for the specified country.'
      };
    }

    return {
      isValid: true,
      e164: phoneNumber.number, // Canonical E.164 e.g. +8801712345678, +819012345678
      internationalFormatted: phoneNumber.formatInternational(),
      nationalFormatted: phoneNumber.formatNational(),
      countryCode: (phoneNumber.country as CountryCode) || defaultCountry || null,
      callingCode: phoneNumber.countryCallingCode ? `+${phoneNumber.countryCallingCode}` : null,
      error: null
    };
  } catch {
    return {
      isValid: false,
      e164: null,
      internationalFormatted: null,
      nationalFormatted: null,
      countryCode: null,
      callingCode: null,
      error: 'Failed to parse international phone number.'
    };
  }
}

/**
 * Formats user input as they type
 */
export function formatPhoneNumberAsYouType(input: string, country?: CountryCode | null): string {
  if (!input) return '';
  const formatter = new AsYouType(country || undefined);
  return formatter.input(input);
}

/**
 * Search countries across:
 * 1. Country display name
 * 2. ISO country code (e.g. BD, US, IN, JP, GB)
 * 3. International calling code (e.g. +880, 880, +91, +81, +55)
 */
export function searchCountries(queryText: string): CountryInfo[] {
  if (!queryText || !queryText.trim()) {
    return INTERNATIONAL_COUNTRIES;
  }
  const q = queryText.toLowerCase().trim();
  const cleanDigits = q.replace(/[^0-9]/g, '');

  return INTERNATIONAL_COUNTRIES.filter((c) => {
    const nameMatch = c.name.toLowerCase().includes(q);
    const codeMatch = c.code.toLowerCase().includes(q);
    const dialMatch =
      c.dialCode.includes(q) ||
      (cleanDigits.length > 0 && c.dialCode.replace('+', '').includes(cleanDigits));
    return nameMatch || codeMatch || dialMatch;
  });
}

