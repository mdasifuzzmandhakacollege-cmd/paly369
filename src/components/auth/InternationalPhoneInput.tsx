import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  INTERNATIONAL_COUNTRIES,
  CountryInfo,
  validateAndNormalizePhoneNumber,
  formatPhoneNumberAsYouType,
  getCountryByCode,
  detectBrowserCountryCode,
  detectCountryFromPhoneNumber,
  searchCountries
} from '../../lib/phoneUtils';
import { CountryCode } from 'libphonenumber-js';

interface InternationalPhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string, e164: string | null, isValid: boolean) => void;
  defaultCountryCode?: CountryCode | null;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const InternationalPhoneInput: React.FC<InternationalPhoneInputProps> = ({
  id = 'play369-phone-input',
  value,
  onChange,
  defaultCountryCode,
  placeholder = 'e.g. 1712345678 or +8801712345678',
  disabled = false,
  autoFocus = false
}) => {
  // Determine initial country: (A) explicit prop, (B) detected browser locale, (C) neutral (null)
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | null>(() => {
    if (defaultCountryCode) {
      const explicit = getCountryByCode(defaultCountryCode);
      if (explicit) return explicit;
    }
    const detected = detectBrowserCountryCode();
    if (detected) {
      const detectedInfo = getCountryByCode(detected);
      if (detectedInfo) return detectedInfo;
    }
    return null;
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [localNumber, setLocalNumber] = useState<string>(value || '');
  const [touched, setTouched] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Compute current validation
  const validationResult = validateAndNormalizePhoneNumber(
    localNumber,
    selectedCountry ? selectedCountry.code : null
  );

  const handleCountrySelect = (country: CountryInfo) => {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery('');
    setTouched(true);

    // Re-validate with newly selected country
    const newValidation = validateAndNormalizePhoneNumber(localNumber, country.code);
    onChange(localNumber, newValidation.isValid ? newValidation.e164 : null, newValidation.isValid);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setTouched(true);

    // If typing starts with '+', attempt auto-detecting the country
    if (rawVal.trim().startsWith('+')) {
      const detected = detectCountryFromPhoneNumber(rawVal);
      if (detected && (!selectedCountry || selectedCountry.code !== detected.code)) {
        setSelectedCountry(detected);
      }
    }

    const formatted = formatPhoneNumberAsYouType(
      rawVal,
      selectedCountry ? selectedCountry.code : null
    );
    setLocalNumber(formatted);

    const result = validateAndNormalizePhoneNumber(
      formatted,
      selectedCountry ? selectedCountry.code : null
    );
    onChange(formatted, result.isValid ? result.e164 : null, result.isValid);
  };

  const filteredCountries = searchCountries(searchQuery);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="flex items-center rounded-xl bg-[#02180e] border border-emerald-800/60 focus-within:border-amber-400 focus-within:ring-1 focus-within:ring-amber-400/40 transition-all">
        {/* Country Code Trigger Button (Min 48px Touch Target) */}
        <button
          type="button"
          id="play369-country-picker-btn"
          disabled={disabled}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          aria-haspopup="listbox"
          aria-expanded={isDropdownOpen}
          aria-label={selectedCountry ? `Selected ${selectedCountry.name} (${selectedCountry.dialCode})` : 'Select Country Calling Code'}
          className="min-h-[48px] px-2.5 sm:px-3.5 flex items-center space-x-1.5 bg-emerald-950/70 hover:bg-emerald-900/70 border-r border-emerald-800/60 rounded-l-xl text-emerald-200 text-xs sm:text-sm font-semibold transition-colors cursor-pointer shrink-0 disabled:opacity-50 select-none active:bg-emerald-900"
        >
          {selectedCountry ? (
            <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
              <span className="text-base sm:text-lg leading-none select-none">{selectedCountry.flag}</span>
              <span className="font-mono font-bold text-amber-300 text-xs sm:text-sm">{selectedCountry.dialCode}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
              <Globe className="w-4 h-4 text-emerald-400" />
              <span className="font-sans font-semibold text-emerald-300 text-xs hidden xs:inline">Select</span>
            </div>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-emerald-400/80 transition-transform duration-200 shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Local Number Input */}
        <div className="relative flex-1 min-w-0 flex items-center">
          <input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            autoFocus={autoFocus}
            disabled={disabled}
            value={localNumber}
            onChange={handleInputChange}
            onBlur={() => setTouched(true)}
            placeholder={
              selectedCountry
                ? `e.g. mobile for ${selectedCountry.code}`
                : placeholder
            }
            className="w-full min-h-[48px] px-3 sm:px-3.5 bg-transparent text-white placeholder-emerald-700/70 text-xs sm:text-sm font-mono focus:outline-none disabled:opacity-50 min-w-0"
          />

          {/* Validation Status Indicator */}
          {localNumber.trim().length > 0 && touched && (
            <div className="pr-2.5 sm:pr-3.5 flex items-center shrink-0">
              {validationResult.isValid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Country Selector Dropdown Popover */}
      <AnimatePresence>
        {isDropdownOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 sm:right-auto top-full mt-1.5 w-full sm:w-84 max-w-[calc(100vw-32px)] z-50 rounded-2xl bg-[#02180e] border border-amber-500/40 shadow-2xl shadow-black/90 backdrop-blur-xl overflow-hidden"
          >
            {/* Search Country Header */}
            <div className="p-2 sm:p-2.5 border-b border-emerald-800/60 bg-[#01140b]">
              <div className="relative flex items-center">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/80 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search country, code (+880, +1, +81)..."
                  className="w-full min-h-[44px] pl-9 pr-11 rounded-lg bg-[#02180e] border border-emerald-800/80 text-white placeholder-emerald-700 text-xs focus:outline-none focus:border-amber-400 font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear country search"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-0 inset-y-0 min-w-[48px] min-h-[48px] flex items-center justify-center text-emerald-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Country List (Complete libphonenumber-js directory) */}
            <div className="max-h-60 overflow-y-auto divide-y divide-emerald-900/30 font-sans overscroll-contain">
              {filteredCountries.length === 0 ? (
                <div className="p-4 text-center text-xs text-emerald-400/60">
                  No country found matching &quot;{searchQuery}&quot;
                </div>
              ) : (
                filteredCountries.map((country) => {
                  const isSelected = selectedCountry?.code === country.code;
                  return (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => handleCountrySelect(country)}
                      className={`w-full min-h-[48px] px-3.5 py-2 flex items-center justify-between text-left transition-colors cursor-pointer select-none active:bg-emerald-900/60 ${
                        isSelected
                          ? 'bg-amber-500/15 text-amber-300 font-bold'
                          : 'hover:bg-emerald-950/60 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                        <span className="text-lg shrink-0 leading-none">{country.flag}</span>
                        <span className="text-xs truncate font-medium">{country.name}</span>
                        <span className="text-[10px] text-emerald-500/80 font-mono shrink-0">({country.code})</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-amber-400 shrink-0 ml-2">
                        {country.dialCode}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

