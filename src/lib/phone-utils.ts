/**
 * Normalize phone number to E.164 format for Philippines (+63)
 * Handles: 09xxxxxxxxx, 63xxxxxxxxxx, +63xxxxxxxxxx
 */
export function normalizePhoneToE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('+63')) {
    // Already in E.164 format
    return cleaned;
  } else if (cleaned.startsWith('63') && cleaned.length >= 12) {
    // 63xxxxxxxxxx format
    return '+' + cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    // 09xxxxxxxxx format - convert to +639xxxxxxxxx
    return '+63' + cleaned.substring(1);
  } else if (cleaned.length === 10 && cleaned.startsWith('9')) {
    // 9xxxxxxxxx format - add +63
    return '+63' + cleaned;
  }
  
  // Return original cleaned if we can't normalize
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
}

/**
 * Format phone number for display (readable format)
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return '-';
  const e164 = normalizePhoneToE164(phone);
  if (!e164) return phone;
  
  // Format as +63 XXX XXX XXXX
  if (e164.startsWith('+63') && e164.length === 13) {
    return `${e164.slice(0, 3)} ${e164.slice(3, 6)} ${e164.slice(6, 9)} ${e164.slice(9)}`;
  }
  return e164;
}

/**
 * Get tel: link for making calls
 */
export function getTelLink(phone: string | null | undefined): string | null {
  const e164 = normalizePhoneToE164(phone);
  return e164 ? `tel:${e164}` : null;
}

/**
 * Get Telegram deep link for chat
 * Uses https://t.me/+<E164Number> format
 */
export function getTelegramLink(telegramPhone: string | null | undefined, fallbackPhone: string | null | undefined): string | null {
  const phone = telegramPhone || fallbackPhone;
  const e164 = normalizePhoneToE164(phone);
  
  if (!e164) return null;
  
  // Telegram deep link format: https://t.me/+<E164Number>
  // Remove the + for the URL since we add it in the path
  return `https://t.me/${e164}`;
}

/**
 * Mask phone number for privacy (e.g., +63 9** *** 1234)
 * Shows country code and last 4 digits only
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '-';
  const e164 = normalizePhoneToE164(phone);
  if (!e164) return phone;
  
  // For Philippine numbers (+63XXXXXXXXXX), show +63 9** *** XXXX
  if (e164.startsWith('+63') && e164.length === 13) {
    const last4 = e164.slice(-4);
    return `+63 9** *** ${last4}`;
  }
  
  // For other numbers, show first 3 chars + masked middle + last 4
  if (e164.length > 7) {
    const prefix = e164.slice(0, 3);
    const last4 = e164.slice(-4);
    const maskedLength = e164.length - 7;
    const masked = '*'.repeat(maskedLength);
    return `${prefix}${masked}${last4}`;
  }
  
  return e164;
}
