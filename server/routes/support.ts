import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { SupportTicket } from '../../src/types';

const router = Router();

// GET /api/v1/support/tickets
router.get('/tickets', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const isAdmin = ['admin', 'super_admin', 'support', 'moderator'].includes(req.user!.role);

  const userTickets = isAdmin
    ? db.tickets
    : db.tickets.filter(t => t.userId === req.user!.id);

  res.json({ success: true, data: userTickets });
});

// GET /api/v1/support/tickets/:id
router.get('/tickets/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const ticket = db.tickets.find(t => t.id === req.params.id);

  if (!ticket) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
  }

  const isAdmin = ['admin', 'super_admin', 'support', 'moderator'].includes(req.user!.role);
  if (ticket.userId !== req.user!.id && !isAdmin) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  res.json({ success: true, data: ticket });
});

// POST /api/v1/support/tickets or /api/v1/support/tickets/create
const handleCreateTicket = async (req: AuthenticatedRequest, res: Response) => {
  const { subject, category, priority, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Subject and message required.' } });
  }

  const db = await getDb();

  const newTicket: SupportTicket = {
    id: `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: req.user!.id,
    userName: req.user!.displayName || req.user!.username || req.user!.email.split('@')[0],
    userEmail: req.user!.email,
    subject: subject.trim(),
    category: category || 'General Inquiry',
    priority: priority || 'medium',
    status: 'open',
    messages: [
      {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        senderId: req.user!.id,
        senderName: req.user!.displayName || req.user!.username || req.user!.email.split('@')[0],
        senderRole: req.user!.role,
        message: message.trim(),
        createdAt: new Date().toISOString()
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.tickets.unshift(newTicket);
  saveDbSync();

  res.json({ success: true, message: 'Support ticket submitted.', data: newTicket });
};

router.post('/tickets', authMiddleware, handleCreateTicket);
router.post('/tickets/create', authMiddleware, handleCreateTicket);

// POST /api/v1/support/tickets/:id/reply
router.post('/tickets/:id/reply', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ success: false, error: { code: 'MESSAGE_REQUIRED', message: 'Message content required' } });

  const db = await getDb();
  const ticket = db.tickets.find(t => t.id === req.params.id);

  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

  const isAdmin = ['admin', 'super_admin', 'support', 'moderator'].includes(req.user!.role);
  if (ticket.userId !== req.user!.id && !isAdmin) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  const newMsg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    senderId: req.user!.id,
    senderName: isAdmin ? 'Aether Technical Support' : (req.user!.displayName || req.user!.username || req.user!.email.split('@')[0]),
    senderRole: req.user!.role,
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  ticket.messages.push(newMsg);
  ticket.status = isAdmin ? 'answered' : 'open';
  ticket.updatedAt = new Date().toISOString();

  saveDbSync();

  res.json({ success: true, message: 'Reply submitted.', data: ticket });
});

// PATCH /api/v1/support/tickets/:id/close
router.patch('/tickets/:id/close', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const ticket = db.tickets.find(t => t.id === req.params.id);

  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

  const isAdmin = ['admin', 'super_admin', 'support', 'moderator'].includes(req.user!.role);
  if (ticket.userId !== req.user!.id && !isAdmin) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
  }

  ticket.status = 'closed';
  ticket.updatedAt = new Date().toISOString();
  saveDbSync();

  res.json({ success: true, message: 'Ticket closed.', data: ticket });
});

// PUT /api/v1/support/tickets/:id/status
router.put('/tickets/:id/status', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  const db = await getDb();
  const ticket = db.tickets.find(t => t.id === req.params.id);

  if (!ticket) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });

  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();
  saveDbSync();

  res.json({ success: true, data: ticket });
});

export default router;
