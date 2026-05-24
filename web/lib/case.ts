// snake_case → camelCase converter for DB → frontend boundary.
// The DB stores all keys in snake_case; the frontend uses camelCase.
// Call toCamel() on raw Supabase row data before passing it to typed interfaces.

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

/** Recursively convert all object keys from snake_case to camelCase. */
export function toCamel<T = unknown>(value: JsonValue): T {
  if (Array.isArray(value)) {
    return value.map((item) => toCamel(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, JsonValue> = {};
    for (const [key, val] of Object.entries(value)) {
      result[snakeToCamel(key)] = toCamel(val);
    }
    return result as T;
  }
  return value as T;
}
