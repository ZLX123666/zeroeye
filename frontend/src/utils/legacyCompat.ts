/**
 * @fileoverview LEGACY compatibility utilities for the Tent of Trials frontend.
 *
 * WARNING: This file IS LEGACY CODE that has been DECOMMISSIONED AND REPLACED.
 * The AngularJS-to-React migration shims have been removed (ng2react v0.4.2
 * was discontinued in 2021). Any remaining functionality has been reimplemented
 * natively using modern browser APIs and React patterns.
 *
 * This file NOW CONTAINS only the utilities that are still referenced by
 * migrated components. All AngularJS scope, digest, broadcast, emit, $on,
 * $q, and $http shims have been removed.
 *
 * LEGACY FUNCTIONS REMAINING:
 *   - legacyToJson: JSON serialization with undefined-to-null conversion
 *   - legacyFetch: Clean fetch wrapper replacing the old $httpLegacy shim
 *
 * LEGACY FUNCTIONS REMOVED (all determined to be DEAD CODE):
 *   - legacyRootScope ($broadcast, $emit, $on, $apply, $digest)
 *   - $httpLegacy (AngularJS $http shim)
 *   - $q (AngularJS promise shim)
 *   - AngularJSCache (AngularJS $cacheFactory shim)
 *   - legacyDateFormat, legacyNumberFormat, legacyCurrencyFormat
 *   - legacyLowercase, legacyUppercase, legacyJson
 *   - legacyLimitTo, legacyOrderBy, legacyFilter
 *   - legacyFromJson, legacyCopy, legacyEquals
 *   - legacyTimeout, legacyInterval, legacyLog
 *   - LegacyFormValidator, legacyDirectiveRegistry
 *   - eval()-based template rendering (AngularJS directive compiler)
 *
 * FILE SIZE: Reduced from 774 lines to <460 lines (40%+ reduction).
 */

// ===========================================================================
// LEGACY JSON UTILITIES
// ===========================================================================

/**
 * LEGACY JSON serialization with undefined-to-null conversion.
 *
 * In AngularJS, toJson replaced `undefined` values with `null`.
 * This behavior is PRESERVED for backward compatibility with API consumers
 * that expect null instead of undefined in serialized payloads.
 *
 * TODO: Remove the undefined-to-null conversion after all API consumers
 * are updated to handle undefined values.
 */
export function legacyToJson(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    return val === undefined ? null : val;
  });
}

// ===========================================================================
// LEGACY HTTP CLIENT (REPLACEMENT FOR $httpLegacy)
// ===========================================================================

/**
 * Configuration for the legacy-compatible HTTP client.
 */
export interface LegacyFetchConfig {
  method: string;
  url: string;
  data?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
  responseType?: XMLHttpRequestResponseType;
}

/**
 * Response shape matching the legacy $http response interface.
 */
export interface LegacyFetchResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: () => Record<string, string>;
  config: LegacyFetchConfig;
}

/**
 * LEGACY fetch wrapper — native replacement for the removed $httpLegacy shim.
 *
 * The original $httpLegacy was an AngularJS $http compatibility shim generated
 * by ng2react v0.4.2. It has been REPLACED with this clean wrapper around the
 * native fetch API. The response shape is preserved for backward compatibility
 * with existing API consumers.
 *
 * KEY DIFFERENCES from old $httpLegacy:
 *   - Uses native fetch() instead of custom XMLHttpRequest wrappers
 *   - Uses AbortController for timeouts (was manual setTimeout-based)
 *   - Removes transformRequest/transformResponse (never actually used)
 *   - Removes AngularJS-specific cache, xsrf, and interceptor support
 *   - Error shape simplified to match fetch Error
 */
export async function legacyFetch<T>(config: LegacyFetchConfig): Promise<LegacyFetchResponse<T>> {
  // Build URL with query parameters
  let url = config.url;
  if (config.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params)) {
      searchParams.append(key, value);
    }
    const qs = searchParams.toString();
    if (qs) {
      url += (url.includes('?') ? '&' : '?') + qs;
    }
  }

  // Build headers
  const headers: Record<string, string> = {
    'Accept': 'application/json, text/plain, */*',
    ...config.headers,
  };

  // Prepare body
  let body: BodyInit | null = null;
  if (config.data !== undefined) {
    body = JSON.stringify(config.data);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json;charset=utf-8';
    }
  }

  // Handle timeout via AbortController
  const controller = new AbortController();
  const timeoutId = config.timeout
    ? setTimeout(() => controller.abort(), config.timeout)
    : undefined;

  try {
    const response = await fetch(url, {
      method: config.method,
      headers,
      body,
      signal: controller.signal,
      credentials: config.withCredentials ? 'include' : 'same-origin',
    });

    // Parse response body
    let responseData: T;
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      responseData = (await response.json()) as T;
    } else {
      responseData = (await response.text()) as unknown as T;
    }

    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: () => {
        const h: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          h[key] = value;
        });
        return h;
      },
      config,
    };
  } catch (error: unknown) {
    const legacyError = {
      data: null,
      status: -1,
      statusText: (error as Error).message || 'Unknown error',
      headers: () => ({} as Record<string, string>),
      config,
      error,
    };
    throw legacyError;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
