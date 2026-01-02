// app/src/services/api/MusicApi.ts
// Frontend API client for music service

import type {
  SearchQuery,
  SearchResult,
  SongDetail,
  AudioUrlQuery,
  AudioUrlResult,
  BatchAudioUrlRequest,
  BatchAudioUrlResult,
  ApiResponse,
} from '@shared/types/api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Music API Client
 * Communicates with backend music service
 */
export class MusicApi {
  /**
   * Search for songs
   */
  async search(query: SearchQuery): Promise<ApiResponse<SearchResult>> {
    try {
      const params = new URLSearchParams({
        keyword: query.keyword,
        ...(query.limit && { limit: query.limit.toString() }),
        ...(query.offset && { offset: query.offset.toString() }),
      });

      const response = await fetch(`${API_BASE_URL}/api/music/search?${params}`);
      const data: ApiResponse<SearchResult> = await response.json();
      return data;
    } catch (error) {
      console.error('[MusicApi] Search error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }

  /**
   * Get song detail
   */
  async getSongDetail(trackId: string): Promise<ApiResponse<SongDetail>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/music/song/${trackId}`);
      const data: ApiResponse<SongDetail> = await response.json();
      return data;
    } catch (error) {
      console.error('[MusicApi] Get song detail error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }

  /**
   * Get audio URL
   */
  async getAudioUrl(trackId: string, query: AudioUrlQuery = {}): Promise<ApiResponse<AudioUrlResult>> {
    try {
      const params = new URLSearchParams({
        ...(query.quality && { quality: query.quality }),
        ...(query.refresh && { refresh: 'true' }),
      });

      const response = await fetch(`${API_BASE_URL}/api/music/audio/${trackId}?${params}`);
      const data: ApiResponse<AudioUrlResult> = await response.json();
      return data;
    } catch (error) {
      console.error('[MusicApi] Get audio URL error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }

  /**
   * Get batch audio URLs
   */
  async getBatchAudioUrls(request: BatchAudioUrlRequest): Promise<ApiResponse<BatchAudioUrlResult>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/music/batch/audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      const data: ApiResponse<BatchAudioUrlResult> = await response.json();
      return data;
    } catch (error) {
      console.error('[MusicApi] Get batch audio URLs error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }

  /**
   * Check service health
   */
  async checkHealth(): Promise<{ status: string; cache?: any; timestamp?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/music/health`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[MusicApi] Health check error:', error);
      return { status: 'error' };
    }
  }
}

// Singleton instance
export const musicApi = new MusicApi();
