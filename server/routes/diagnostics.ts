import { Router, Request, Response } from 'express';
import {
  recordUiError,
  getUiErrors,
  clearUiErrors,
  resolveUiError,
  getUiDiagnosticStats
} from '../services/uiDiagnosticService';
import { authMiddleware, AuthenticatedRequest } from '../auth';

const router = Router();

// ==========================================
// PUBLIC INGESTION ENDPOINT FOR UI ERRORS
// ==========================================

// POST /api/v1/diagnostics/ui-errors or /api/v1/public/diagnostics/ui-errors
router.post('/ui-errors', async (req: Request, res: Response) => {
  try {
    const {
      errorName,
      errorMessage,
      componentName,
      componentStack,
      stack,
      url,
      pathname,
      userAgent,
      screenWidth,
      screenHeight,
      userId,
      userRole,
      severity
    } = req.body || {};

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

    const result = await recordUiError({
      errorName,
      errorMessage,
      componentName,
      componentStack,
      stack,
      url: url || req.headers.referer,
      pathname,
      userAgent: userAgent || req.headers['user-agent'],
      screenWidth,
      screenHeight,
      userId,
      userRole,
      severity
    }, clientIp);

    res.json({
      success: true,
      message: result.deduplicated ? 'Duplicate incident suppressed' : 'UI diagnostic telemetry recorded',
      data: {
        incidentId: result.errorLog.id,
        timestamp: result.errorLog.timestamp,
        component: result.errorLog.componentName,
        deduplicated: result.deduplicated
      }
    });
  } catch (error: any) {
    console.error('Error recording UI diagnostic log:', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOG_RECORD_FAILED', message: error.message || 'Failed to save UI error diagnostic log' }
    });
  }
});

// GET /api/v1/diagnostics/stats - Public high-level stats for monitoring
router.get('/stats', async (req: Request, res: Response) => {
  const stats = await getUiDiagnosticStats();
  res.json({ success: true, data: stats });
});

// ==========================================
// ADMIN DIAGNOSTIC MANAGEMENT ENDPOINTS
// ==========================================

// GET /api/v1/diagnostics/ui-errors/list (Admin only)
router.get('/ui-errors/list', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
  }

  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const errors = await getUiErrors(limit);
  const stats = await getUiDiagnosticStats();

  res.json({
    success: true,
    data: {
      stats,
      errors
    }
  });
});

// DELETE /api/v1/diagnostics/ui-errors (Admin only)
router.delete('/ui-errors', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
  }

  await clearUiErrors();
  res.json({
    success: true,
    message: 'UI error logs cleared successfully.'
  });
});

// PATCH /api/v1/diagnostics/ui-errors/:id/resolve (Admin only)
router.patch('/ui-errors/:id/resolve', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
  }

  const success = await resolveUiError(req.params.id);
  if (!success) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Error log not found' } });
  }

  res.json({
    success: true,
    message: 'Incident marked as resolved.'
  });
});

export default router;
