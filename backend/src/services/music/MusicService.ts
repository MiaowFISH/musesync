// backend/src/services/music/MusicService.ts
// NetEase Cloud Music API proxy service

import type {
  SearchQuery,
  SearchResult,
  SearchSong,
  SongDetail,
  AudioUrlQuery,
  AudioUrlResult,
  BatchAudioUrlRequest,
  BatchAudioUrlResult,
  ApiResponse,
} from '@shared/types/api';
import { API_ERROR_CODES, AUDIO_CONFIG } from '@shared/constants';

/**
 * Music Service
 * Proxies requests to NetEase Cloud Music API with caching and rate limiting
 * TODO: Implement actual NetEase API integration using 'neteasecloudmusicapienhanced' package
 */
export class MusicService {
  private cache: Map<string, { data: unknown; expiry: number }> = new Map();

  constructor() {
    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }

  /**
   * Search for songs
   * Cache TTL: 24 hours
   */
  async search(query: SearchQuery): Promise<ApiResponse<SearchResult>> {
    try {
      // Validate keyword
      if (!query.keyword || query.keyword.trim().length === 0) {
        return {
          success: false,
          error: {
            code: API_ERROR_CODES.INVALID_KEYWORD,
            message: 'Search keyword is required',
          },
        };
      }

      // Check cache
      const cacheKey = `search:${query.keyword}:${query.limit || 20}:${query.offset || 0}`;
      const cached = this.getFromCache<SearchResult>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached.data,
          cached: true,
          cacheExpiry: cached.expiry,
        };
      }

      // TODO: Call NetEase API
      // For now, return mock data
      const mockResult: SearchResult = {
        songs: [],
        totalCount: 0,
      };

      // Cache for 24 hours
      const cacheExpiry = Date.now() + 86400000;
      this.setCache(cacheKey, mockResult, cacheExpiry);

      return {
        success: true,
        data: mockResult,
        cached: false,
        cacheExpiry,
      };
    } catch (error) {
      console.error('[MusicService] Search error:', error);
      return {
        success: false,
        error: {
          code: API_ERROR_CODES.NETEASE_API_ERROR,
          message: error instanceof Error ? error.message : 'Search failed',
        },
      };
    }
  }

  /**
   * Get song detail
   * Cache TTL: 24 hours
   */
  async getSongDetail(trackId: string): Promise<ApiResponse<SongDetail>> {
    try {
      // Validate track ID
      if (!/^\d+$/.test(trackId)) {
        return {
          success: false,
          error: {
            code: API_ERROR_CODES.INVALID_TRACK_ID,
            message: 'Invalid track ID format',
          },
        };
      }

      // Check cache
      const cacheKey = `song:${trackId}`;
      const cached = this.getFromCache<SongDetail>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached.data,
          cached: true,
          cacheExpiry: cached.expiry,
        };
      }

      // TODO: Call NetEase API
      // For now, return error
      return {
        success: false,
        error: {
          code: API_ERROR_CODES.SONG_NOT_FOUND,
          message: 'Song not found',
        },
      };
    } catch (error) {
      console.error('[MusicService] Get song detail error:', error);
      return {
        success: false,
        error: {
          code: API_ERROR_CODES.NETEASE_API_ERROR,
          message: error instanceof Error ? error.message : 'Failed to get song detail',
        },
      };
    }
  }

  /**
   * Get audio URL for a track
   * Cache TTL: 20 minutes
   */
  async getAudioUrl(
    trackId: string,
    query: AudioUrlQuery = {}
  ): Promise<ApiResponse<AudioUrlResult>> {
    try {
      // Validate track ID
      if (!/^\d+$/.test(trackId)) {
        return {
          success: false,
          error: {
            code: API_ERROR_CODES.INVALID_TRACK_ID,
            message: 'Invalid track ID format',
          },
        };
      }

      const quality = query.quality || 'exhigh';

      // Check cache (unless refresh is requested)
      if (!query.refresh) {
        const cacheKey = `audio:${trackId}:${quality}`;
        const cached = this.getFromCache<AudioUrlResult>(cacheKey);
        if (cached) {
          // Check if audio URL is still valid (not expired)
          if (cached.data.audioUrlExpiry > Date.now() + 60000) {
            // At least 1 minute left
            return {
              success: true,
              data: cached.data,
              cached: true,
              cacheExpiry: cached.expiry,
            };
          }
        }
      }

      // TODO: Call NetEase API
      // For now, return error
      return {
        success: false,
        error: {
          code: API_ERROR_CODES.AUDIO_NOT_AVAILABLE,
          message: 'Audio not available',
        },
      };
    } catch (error) {
      console.error('[MusicService] Get audio URL error:', error);
      return {
        success: false,
        error: {
          code: API_ERROR_CODES.NETEASE_API_ERROR,
          message: error instanceof Error ? error.message : 'Failed to get audio URL',
        },
      };
    }
  }

  /**
   * Get audio URLs for multiple tracks (batch)
   * Max 10 tracks per request
   */
  async getBatchAudioUrls(request: BatchAudioUrlRequest): Promise<ApiResponse<BatchAudioUrlResult>> {
    try {
      // Validate request
      if (!Array.isArray(request.trackIds) || request.trackIds.length === 0) {
        return {
          success: false,
          error: {
            code: API_ERROR_CODES.INVALID_REQUEST,
            message: 'trackIds array is required',
          },
        };
      }

      if (request.trackIds.length > 10) {
        return {
          success: false,
          error: {
            code: API_ERROR_CODES.INVALID_REQUEST,
            message: 'Maximum 10 tracks per batch request',
          },
        };
      }

      const quality = request.quality || 'exhigh';
      const results = await Promise.all(
        request.trackIds.map(async (trackId) => {
          const result = await this.getAudioUrl(trackId, { quality });
          return {
            trackId,
            success: result.success,
            data: result.data,
            error: result.error,
          };
        })
      );

      return {
        success: true,
        data: { results },
      };
    } catch (error) {
      console.error('[MusicService] Batch audio URLs error:', error);
      return {
        success: false,
        error: {
          code: API_ERROR_CODES.NETEASE_API_ERROR,
          message: error instanceof Error ? error.message : 'Batch request failed',
        },
      };
    }
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<'ok' | 'degraded' | 'down'> {
    try {
      // TODO: Ping NetEase API
      return 'ok';
    } catch {
      return 'down';
    }
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  private getFromCache<T>(key: string): { data: T; expiry: number } | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    if (Date.now() >= cached.expiry) {
      this.cache.delete(key);
      return null;
    }

    return cached as { data: T; expiry: number };
  }

  private setCache(key: string, data: unknown, expiry: number): void {
    this.cache.set(key, { data, expiry });
  }

  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (now >= value.expiry) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`[MusicService] Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const musicService = new MusicService();
