import assert from 'assert';
import {
  validateAndNormalizePhoneNumber,
  formatPhoneNumberAsYouType,
  getCountryByCode,
  searchCountries,
  INTERNATIONAL_COUNTRIES
} from '../../lib/phoneUtils';

async function runAuthTaskA0TestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING PLAY369 AUTH TASK A0: INTERNATIONAL PHONE & EMAIL FOUNDATION');
  console.log('================================================================');

  let passed = 0;

  // 1. Bangladesh Number Normalization (E.164 without forced hardcoding)
  const bdRes = validateAndNormalizePhoneNumber('01712345678', 'BD');
  assert.strictEqual(bdRes.isValid, true, 'BD mobile should be valid');
  assert.strictEqual(bdRes.e164, '+8801712345678', 'BD mobile must normalize to +8801712345678');
  assert.strictEqual(bdRes.callingCode, '+880', 'BD calling code must be +880');
  console.log('  ✅ PASS: 1. Bangladesh mobile normalizes to E.164 (+8801712345678)');
  passed++;

  // 2. India Mobile Normalization
  const inRes = validateAndNormalizePhoneNumber('9876543210', 'IN');
  assert.strictEqual(inRes.isValid, true, 'India mobile should be valid');
  assert.strictEqual(inRes.e164, '+919876543210', 'India mobile must normalize to +919876543210');
  assert.strictEqual(inRes.callingCode, '+91', 'India calling code must be +91');
  console.log('  ✅ PASS: 2. India mobile normalizes to E.164 (+919876543210)');
  passed++;

  // 3. Singapore Mobile Normalization
  const sgRes = validateAndNormalizePhoneNumber('81234567', 'SG');
  assert.strictEqual(sgRes.isValid, true, 'Singapore mobile should be valid');
  assert.strictEqual(sgRes.e164, '+6581234567', 'Singapore mobile must normalize to +6581234567');
  console.log('  ✅ PASS: 3. Singapore mobile normalizes to E.164 (+6581234567)');
  passed++;

  // 4. UK Mobile Normalization
  const gbRes = validateAndNormalizePhoneNumber('07987654321', 'GB');
  assert.strictEqual(gbRes.isValid, true, 'UK mobile should be valid');
  assert.strictEqual(gbRes.e164, '+447987654321', 'UK mobile must normalize to +447987654321');
  console.log('  ✅ PASS: 4. United Kingdom mobile normalizes to E.164 (+447987654321)');
  passed++;

  // 5. US & Canada Mobile Normalization
  const usRes = validateAndNormalizePhoneNumber('4155552671', 'US');
  assert.strictEqual(usRes.isValid, true, 'US mobile should be valid');
  assert.strictEqual(usRes.e164, '+14155552671', 'US mobile must normalize to +14155552671');
  console.log('  ✅ PASS: 5. US/Canada numbers normalize to E.164 (+14155552671)');
  passed++;

  // 6. UAE Mobile Normalization
  const aeRes = validateAndNormalizePhoneNumber('501234567', 'AE');
  assert.strictEqual(aeRes.isValid, true, 'UAE mobile should be valid');
  assert.strictEqual(aeRes.e164, '+971501234567', 'UAE mobile must normalize to +971501234567');
  console.log('  ✅ PASS: 6. UAE mobile normalizes to E.164 (+971501234567)');
  passed++;

  // 7. Invalid number rejection
  const invalidRes = validateAndNormalizePhoneNumber('1234', 'BD');
  assert.strictEqual(invalidRes.isValid, false, 'Incomplete number must be invalid');
  assert.strictEqual(invalidRes.e164, null, 'Invalid number must not produce E.164');
  console.log('  ✅ PASS: 7. Invalid or incomplete numbers rejected safely');
  passed++;

  // 8. International Directory and Search
  assert.ok(INTERNATIONAL_COUNTRIES.length > 30, 'Country list must contain worldwide countries');
  const searchRes = searchCountries('united');
  assert.ok(searchRes.length >= 2, 'Search must match United States, United Kingdom, UAE');
  console.log('  ✅ PASS: 8. International country directory & search working smoothly');
  passed++;

  // 9. As-you-type formatting
  const formatted = formatPhoneNumberAsYouType('01712345678', 'BD');
  assert.ok(formatted.length > 0, 'As-you-type formatter should produce formatted text');
  console.log('  ✅ PASS: 9. As-you-type formatting operational');
  passed++;

  // 10. Fail-closed safety for Phone Auth in server runtime
  const { createRecaptchaVerifier } = await import('../../lib/firebase');
  try {
    createRecaptchaVerifier('recaptcha-container');
    assert.fail('Should have failed in server/node environment');
  } catch (err: any) {
    assert.ok(
      err.code === 'PHONE_AUTH_UNAVAILABLE' || err.message.includes('unavailable'),
      'Should fail safely with PHONE_AUTH_UNAVAILABLE'
    );
  }
  console.log('  ✅ PASS: 10. Fails closed with PHONE_AUTH_UNAVAILABLE in non-browser runtimes');
  passed++;

  console.log('================================================================');
  console.log(`📊 AUTH TASK A0 TEST RUN COMPLETE: ${passed} PASSED, 0 FAILED`);
  console.log('================================================================');
}

runAuthTaskA0TestSuite().catch((err) => {
  console.error('Fatal Auth Task A0 test error:', err);
  process.exit(1);
});
