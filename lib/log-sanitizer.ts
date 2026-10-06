// Sensitive field patterns that must be completely masked or partially obfuscated in old/new values
const FULL_MASK_FIELDS = ["password", "passwordhash", "secret", "token", "key", "cvv", "cardnumber"];
const PARTIAL_MASK_FIELDS = ["pan", "gst", "bank", "accountnumber", "aadhaar", "gstin", "idnumber"];

/**
 * Recursively masks sensitive fields in an object or string before saving to database logs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function maskValue(key: string, val: any): any {
  if (val === null || val === undefined) return val;
  
  const normalizedKey = key.toLowerCase();
  
  // 1. Full Masking
  if (FULL_MASK_FIELDS.some(f => normalizedKey.includes(f))) {
    return "[MASKED]";
  }
  
  // 2. Partial Masking (Keep only last 4 digits/characters)
  if (PARTIAL_MASK_FIELDS.some(f => normalizedKey.includes(f))) {
    const str = String(val).trim();
    if (str.length <= 4) return "****";
    return "*".repeat(str.length - 4) + str.slice(-4);
  }
  
  return val;
}

export function sanitizeLogData(data: unknown): string | null {
  if (data === null || data === undefined) return null;
  
  try {
    if (typeof data === "string") {
      const str = data as string;
      // Check if it looks like JSON
      if (str.startsWith("{") || str.startsWith("[")) {
        const parsed = JSON.parse(str);
        return JSON.stringify(sanitizeObject(parsed));
      }
      return str;
    }
    
    if (typeof data === "object") {
      return JSON.stringify(sanitizeObject(data));
    }
    
    return String(data);
  } catch {
    return String(data);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  if (typeof obj === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cleaned: Record<string, any> = {};
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const val = obj[k];
        if (val !== null && typeof val === "object") {
          cleaned[k] = sanitizeObject(val);
        } else {
          cleaned[k] = maskValue(k, val);
        }
      }
    }
    return cleaned;
  }
  return obj;
}
