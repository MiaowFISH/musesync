// backend/src/routes/music.ts
// Music API routes

import { Router, type Request, Response } from 'express';
import { musicService } from '../services/music/MusicService';
import {
  searchRateLimiter,
  audioRateLimiter,
  detailRateLimiter,
  batchRateLimiter,
} from '../middleware/rateLimiter';
import type {
  SearchQuery,
  AudioUrlQuery,
  BatchAudioUrlRequest,
} from '@shared/types/api';

const router = Router();

/**
 * GET /api/music/search
 * Search for songs
 * Rate limit: 10 req/min
 */
router.get('/search', searchRateLimiter, async (req: Request, res: Response) => {
  try {
    const query: SearchQuery = {
      keyword: req.query.keyword as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    };

    const result = await musicService.search(query);
    res.json(result);
  } catch (error) {
    console.error('[MusicRoute] Search error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
});

/**
 * GET /api/music/song/:id
 * Get song detail
 * Rate limit: 30 req/min
 */
router.get('/song/:id', detailRateLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await musicService.getSongDetail(id);
    res.json(result);
  } catch (error) {
    console.error('[MusicRoute] Song detail error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
});

/**
 * GET /api/music/audio/:id
 * Get audio URL for a track
 * Rate limit: 20 req/min
 */
router.get('/audio/:id', audioRateLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const query: AudioUrlQuery = {
      quality: (req.query.quality as any) || 'exhigh',
      refresh: req.query.refresh === 'true',
    };

    const result = await musicService.getAudioUrl(id, query);
    res.json(result);
  } catch (error) {
    console.error('[MusicRoute] Audio URL error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
});

/**
 * GET /api/music/lyrics/:id
 * Get lyrics for a track
 * Rate limit: 30 req/min
 */
router.get('/lyrics/:id', detailRateLimiter, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await musicService.getLyrics(id);
    res.json(result);
  } catch (error) {
    console.error('[MusicRoute] Lyrics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
});

/**
 * POST /api/music/batch/audio
 * Get audio URLs for multiple tracks
 * Rate limit: 5 req/min
 */
router.post('/batch/audio', batchRateLimiter, async (req: Request, res: Response) => {
  try {
    const request: BatchAudioUrlRequest = req.body;
    const result = await musicService.getBatchAudioUrls(request);
    res.json(result);
  } catch (error) {
    console.error('[MusicRoute] Batch audio URLs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    });
  }
});

/**
 * GET /api/music/health
 * Check music service health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const status = await musicService.checkHealth();
    const cacheStats = musicService.getCacheStats();

    res.json({
      status,
      cache: cacheStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

export default router;
