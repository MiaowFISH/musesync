// backend/src/services/music/MusicService.ts
// NetEase Cloud Music API proxy service

import NeteaseCloudMusicApi from '@neteasecloudmusicapienhanced/api';
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

      // Call NetEase API - use cloudsearch instead of search for better data
      const response = await NeteaseCloudMusicApi.cloudsearch({
        keywords: query.keyword,
        limit: query.limit || 20,
        offset: query.offset || 0,
        type: 1, // 1 = songs
      });

      if (response.body.code !== 200 || !response.body.result) {
        throw new Error('NetEase API returned error');
      }

      const songs: SearchSong[] = (response.body.result.songs || []).map((song: any) => {
        // Get album art - cloudsearch should return al.picUrl
        let albumArt = '';
        const albumData = song.album || song.al || {};
        
        // First try direct picUrl
        if (albumData.picUrl) {
          albumArt = albumData.picUrl;
        } else if (song.al?.picUrl) {
          albumArt = song.al.picUrl;
        } else if (albumData.picId) {
          // Fallback: construct URL from picId (may not work without proper hash)
          albumArt = `https://p3.music.126.net/${albumData.picId}/${albumData.picId}.jpg`;
        }
        
        // Ensure HTTPS
        if (albumArt && albumArt.startsWith('http://')) {
          albumArt = albumArt.replace('http://', 'https://');
        }
        
        // Add size parameter for optimization
        if (albumArt && !albumArt.includes('param=')) {
          albumArt += '?param=200y200';
        }

        return {
          trackId: String(song.id),
          title: song.name,
          artist: song.artists?.map((a: any) => a.name).join(', ') || song.ar?.map((a: any) => a.name).join(', ') || 'Unknown',
          album: albumData.name || '',
          albumArt,
          duration: Math.floor((song.duration || song.dt || 0) / 1000),
        };
      });

      const result: SearchResult = {
        songs,
        totalCount: response.body.result.songCount || 0,
      };

      // Cache for 24 hours
      const cacheExpiry = Date.now() + 86400000;
      this.setCache(cacheKey, result, cacheExpiry);

      return {
        success: true,
        data: result,
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

      // Call NetEase API
      const response = await NeteaseCloudMusicApi.song_detail({ ids: trackId });

      if (response.body.code !== 200 || !response.body.songs || response.body.songs.length === 0) {
        return {
          success: false,
          error: {
            code: API_ERROR_CODES.SONG_NOT_FOUND,
            message: 'Song not found',
          },
        };
      }

      const song = response.body.songs[0];
      
      // Build album art URL
      let albumArt = '';
      const albumData = song.al || {};
      
      if (albumData.picUrl) {
        albumArt = albumData.picUrl;
      } else if (albumData.picId) {
        // Build URL from picId
        albumArt = `https://p3.music.126.net/${albumData.picId}/${albumData.picId}.jpg`;
      } else if (albumData.pic_str) {
        albumArt = `https://p3.music.126.net/${albumData.pic_str}/${albumData.pic_str}.jpg`;
      }
      
      // Ensure HTTPS
      if (albumArt && albumArt.startsWith('http://')) {
        albumArt = albumArt.replace('http://', 'https://');
      }
      
      // Add size parameter for optimization
      if (albumArt && !albumArt.includes('param=')) {
        albumArt += '?param=300y300'; // 300x300 for detail view
      }

      const detail: SongDetail = {
        trackId: String(song.id),
        title: song.name,
        artist: song.ar?.map((a: any) => a.name).join(', ') || 'Unknown',
        album: albumData.name || '',
        albumArt,
        duration: Math.floor((song.dt || 0) / 1000),
        lyrics: '', // TODO: Fetch lyrics separately if needed
      };

      // Cache for 24 hours
      const cacheExpiry = Date.now() + 86400000;
      this.setCache(cacheKey, detail, cacheExpiry);

      return {
        success: true,
        data: detail,
        cached: false,
        cacheExpiry,
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

      // Call NetEase API
      // Quality mapping: standard=128000, high=192000, exhigh=320000, lossless=999000
      const bitrateMap: Record<string, number> = {
        standard: 128000,
        high: 192000,
        exhigh: 320000,
        lossless: 999000,
      };
      const br = bitrateMap[quality] || bitrateMap.exhigh;

      const response = await NeteaseCloudMusicApi.song_url({ id: trackId, br });

      if (response.body.code !== 200 || !response.body.data || response.body.data.length === 0) {
        return {
          success: false,
          error: {
            code: API_ERROR_CODES.AUDIO_NOT_AVAILABLE,
            message: 'Audio not available',
          },
        };
      }

      const audioData = response.body.data[0];
      if (!audioData.url) {
        return {
          success: false,
          error: {
            code: API_ERROR_CODES.AUDIO_NOT_AVAILABLE,
            message: 'Audio URL not available (may require VIP)',
          },
        };
      }

      // Check if this is a free trial version (VIP-only song)
      const isTrial = audioData.freeTrialInfo !== null && audioData.freeTrialInfo !== undefined;
      const trialStart = isTrial ? (audioData.freeTrialInfo?.start || 0) : undefined;
      const trialEnd = isTrial ? (audioData.freeTrialInfo?.end || 0) : undefined;

      // Log trial info for debugging
      if (isTrial) {
        console.log('[MusicService] Trial info detected:', {
          start: trialStart,
          end: trialEnd,
          duration: (typeof trialEnd === 'number' && typeof trialStart === 'number') ? trialEnd - trialStart : 0,
        });
      }

      const result: AudioUrlResult = {
        trackId,
        audioUrl: audioData.url,
        quality,
        bitrate: audioData.br || br,
        audioUrlExpiry: Date.now() + 1200000, // 20 minutes
        isTrial,
        trialStart,
        trialEnd,
      };

      // Cache for 20 minutes
      const cacheExpiry = Date.now() + 1200000;
      this.setCache(`audio:${trackId}:${quality}`, result, cacheExpiry);

      return {
        success: true,
        data: result,
        cached: false,
        cacheExpiry,
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
