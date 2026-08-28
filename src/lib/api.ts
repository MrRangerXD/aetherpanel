/**
 * AetherPanel Frontend API Client
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  total?: number;
  succeeded?: number;
  failed?: number;
  results?: any[];
  error?: {
    code: string;
    message: string;
  };
  [key: string]: any;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('aether_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`/api/v1${endpoint}`, {
      ...options,
      headers
    });

    const contentType = res.headers.get('content-type');
    let data: ApiResponse;

    if (contentType && contentType.includes('application/json')) {
      try {
        data = await res.json();
      } catch (parseErr: any) {
        return {
          success: false,
          error: {
            code: 'JSON_PARSE_ERROR',
            message: `Failed to parse JSON response: ${parseErr.message}`
          }
        };
      }
    } else {
      const text = await res.text();
      return {
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: text.includes('<!doctype') || text.includes('<html') 
            ? `The server returned an HTML response instead of JSON. This usually happens when an API route is missing and falls back to the SPA index.html. (Status: ${res.status})`
            : `Server returned non-JSON content type: ${contentType || 'unknown'} (Status: ${res.status})`
        }
      };
    }

    if (!res.ok && !data.error) {
      return {
        success: false,
        error: {
          code: `HTTP_${res.status}`,
          message: `Request failed with status ${res.status}`
        }
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err.message || 'Failed to connect to AetherPanel API server.'
      }
    };
  }
}
