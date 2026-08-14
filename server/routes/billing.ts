import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../auth';

const router = Router();

// GET /api/v1/billing/orders
router.get('/orders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userOrders = db.orders.filter(o => o.userId === req.user!.id);
  res.json({ success: true, data: userOrders });
});

// POST /api/v1/billing/coupons/validate
router.post('/coupons/validate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, error: { code: 'CODE_REQUIRED', message: 'Coupon code required' } });

  const db = await getDb();
  const coupon = db.coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase() && c.isActive);

  if (!coupon) {
    return res.status(404).json({ success: false, error: { code: 'INVALID_COUPON', message: 'Invalid or expired promotional code.' } });
  }

  if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
    return res.status(400).json({ success: false, error: { code: 'COUPON_EXHAUSTED', message: 'Promotional code has reached its maximum usage limit.' } });
  }

  res.json({
    success: true,
    data: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue
    }
  });
});

// GET /api/v1/billing/payment-methods
router.get('/payment-methods', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  res.json({
    success: true,
    data: db.settings.paymentGateways || {
      upi: { enabled: true, upiId: 'aetherpay@upi', merchantName: 'AetherPanel Hosting', qrCodeUrl: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=400&q=80', instructions: 'Scan QR Code or pay using UPI ID' },
      bank: { enabled: true, bankName: 'Global Bank', accountNumber: '918237192837', ifsc: 'HDFC0001234', accountHolder: 'Aether Cloud LLC', instructions: 'Direct Bank Transfer' },
      stripe: { enabled: true, instructions: 'Credit/Debit Card' }
    }
  });
});

// POST /api/v1/billing/add-credits
router.post('/add-credits', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { amount, paymentMethod, transactionRef, proofUrl } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount < 1) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Minimum deposit amount is $1.00.' } });
  }

  const db = await getDb();
  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const isManualMethod = ['upi', 'qr_code', 'bank', 'crypto'].includes(paymentMethod?.toLowerCase());

  if (isManualMethod && !transactionRef) {
    return res.status(400).json({
      success: false,
      error: { code: 'REF_REQUIRED', message: 'Please provide Transaction Reference / UTR Number after completing payment.' }
    });
  }

  const orderStatus = isManualMethod ? 'pending' : 'paid';

  if (orderStatus === 'paid') {
    user.credits = parseFloat((user.credits + numAmount).toFixed(2));
  }

  // Record Order
  const order = {
    id: `ord_${Date.now()}`,
    userId: user.id,
    userEmail: user.email,
    planId: 'credit_deposit',
    planName: 'Account Credits Deposit',
    billingCycle: 'monthly' as const,
    amount: numAmount,
    currency: db.settings.currencyCode || 'USD',
    status: orderStatus as 'paid' | 'pending',
    paymentMethod: paymentMethod || 'Instant Card',
    transactionRef: transactionRef || undefined,
    proofUrl: proofUrl || undefined,
    createdAt: new Date().toISOString()
  };

  db.orders.unshift(order);
  saveDbSync();

  if (orderStatus === 'pending') {
    return res.json({
      success: true,
      message: `Payment submitted for verification! Transaction Ref: ${transactionRef}. Admin will verify and credit $${numAmount.toFixed(2)} shortly.`,
      data: {
        newBalance: user.credits,
        order
      }
    });
  }

  res.json({
    success: true,
    message: `Successfully added $${numAmount.toFixed(2)} to account credits balance.`,
    data: {
      newBalance: user.credits,
      order
    }
  });
});

export default router;
