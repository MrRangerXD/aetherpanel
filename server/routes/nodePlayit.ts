import { Router, Response } from 'express';
import { authMiddleware, requireRole, AuthenticatedRequest } from '../auth';
import {
  getNodePlayitStatus,
  installNodePlayitAgent,
  toggleNodePlayitAgent,
  restartNodePlayitAgent,
  claimNodePlayitAgent,
  repairNodePlayitAgent,
  getPlayitLogs,
  PlayitConflictError
} from '../playit/playitService';

const router = Router();

// Require admin or support privileges for node infrastructure management
router.use(authMiddleware);
router.use(requireRole(['admin', 'super_admin', 'support', 'moderator']));

// Helper error handler for Playit routes
function handlePlayitError(res: Response, err: any, defaultCode = 'PLAYIT_ERROR') {
  if (err instanceof PlayitConflictError || err?.name === 'PlayitConflictError') {
    return res.status(409).json({
      success: false,
      error: { code: 'OPERATION_IN_PROGRESS', message: err.message }
    });
  }
  return res.status(400).json({
    success: false,
    error: { code: defaultCode, message: err.message || 'Playit operation failed.' }
  });
}

// GET /api/v1/nodes/:nodeId/playit/status - Get Node Playit agent status
router.get('/:nodeId/playit/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await getNodePlayitStatus(req.params.nodeId);
    res.json({ success: true, data: status });
  } catch (err: any) {
    handlePlayitError(res, err, 'PLAYIT_STATUS_FAILED');
  }
});

// POST /api/v1/nodes/:nodeId/playit/install - Install Node Playit agent
router.post('/:nodeId/playit/install', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await installNodePlayitAgent(req.params.nodeId);
    res.json({ success: true, message: 'Node Playit agent installed and started.', data: status });
  } catch (err: any) {
    handlePlayitError(res, err, 'PLAYIT_INSTALL_FAILED');
  }
});

// POST /api/v1/nodes/:nodeId/playit/start - Start Node Playit agent
router.post('/:nodeId/playit/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await toggleNodePlayitAgent(req.params.nodeId, true);
    res.json({ success: true, message: 'Node Playit agent started.', data: status });
  } catch (err: any) {
    handlePlayitError(res, err, 'PLAYIT_START_FAILED');
  }
});

// POST /api/v1/nodes/:nodeId/playit/stop - Stop Node Playit agent
router.post('/:nodeId/playit/stop', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await toggleNodePlayitAgent(req.params.nodeId, false);
    res.json({ success: true, message: 'Node Playit agent stopped.', data: status });
  } catch (err: any) {
    handlePlayitError(res, err, 'PLAYIT_STOP_FAILED');
  }
});

// POST /api/v1/nodes/:nodeId/playit/restart - Restart Node Playit agent
router.post('/:nodeId/playit/restart', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await restartNodePlayitAgent(req.params.nodeId);
    res.json({ success: true, message: 'Node Playit agent restarted.', data: status });
  } catch (err: any) {
    handlePlayitError(res, err, 'PLAYIT_RESTART_FAILED');
  }
});

// POST /api/v1/nodes/:nodeId/playit/claim - Initiate Node Playit agent claim
router.post('/:nodeId/playit/claim', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const claimRes = await claimNodePlayitAgent(req.params.nodeId);
    if (!claimRes.success) {
      return res.status(400).json({
        success: false,
        state: claimRes.state,
        error: { code: 'CLAIM_URL_UNAVAILABLE', message: claimRes.message || 'Playit agent is running, but Playit has not provided a claim URL yet.' },
        data: claimRes
      });
    }
    res.json({ success: true, data: claimRes });
  } catch (err: any) {
    handlePlayitError(res, err, 'PLAYIT_CLAIM_FAILED');
  }
});

// GET /api/v1/nodes/:nodeId/playit/logs - Retrieve Node Playit agent logs
router.get('/:nodeId/playit/logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const lines = parseInt(req.query.lines as string) || 100;
    const logs = getPlayitLogs(req.params.nodeId, true, lines);
    res.json({ success: true, data: { nodeId: req.params.nodeId, logs } });
  } catch (err: any) {
    handlePlayitError(res, err, 'PLAYIT_LOGS_FAILED');
  }
});

// POST /api/v1/nodes/:nodeId/playit/repair - Run Node Playit agent repair
router.post('/:nodeId/playit/repair', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const repairRes = await repairNodePlayitAgent(req.params.nodeId);
    res.json({ success: true, data: repairRes });
  } catch (err: any) {
    handlePlayitError(res, err, 'PLAYIT_REPAIR_FAILED');
  }
});

export default router;
