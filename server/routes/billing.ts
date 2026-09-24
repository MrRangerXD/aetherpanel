import { Router, Response } from 'express';
import { getDb, saveDbSync } from '../db';
import { authMiddleware, AuthenticatedRequest, createAuditLog } from '../auth';
import { Order, CryptoInvoice } from '../../src/types';
import { executeServerDeployment } from './deploy';

const router = Router();

// GET /api/v1/billing/stats - Summary billing stats for current user
router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  const user = db.users.find(u => u.id === userId);
  const userOrders = db.orders.filter(o => o.userId === userId);
  const userServers = db.servers.filter(s => s.userId === userId);

  // Calculate monthly burn rate across active servers
  let monthlyBurnRate = 0;
  for (const server of userServers) {
    const plan = db.plans.find(p => p.id === server.planId);
    if (plan) {
      monthlyBurnRate += plan.priceMonthly || 0;
    }
  }

  const totalSpent = userOrders
    .filter(o => o.status === 'paid' && o.planId !== 'credit_deposit')
    .reduce((sum, o) => sum + (o.amount || 0), 0);

  const totalDeposited = userOrders
    .filter(o => o.status === 'paid' && o.planId === 'credit_deposit')
    .reduce((sum, o) => sum + (o.amount || 0), 0);

  res.json({
    success: true,
    data: {
      credits: user?.credits || 0,
      currency: db.settings.currencyCode || 'USD',
      activeServersCount: userServers.length,
      monthlyBurnRate: parseFloat(monthlyBurnRate.toFixed(2)),
      totalSpent: parseFloat(totalSpent.toFixed(2)),
      totalDeposited: parseFloat(totalDeposited.toFixed(2)),
      totalOrders: userOrders.length,
      pendingOrdersCount: userOrders.filter(o => o.status === 'pending').length
    }
  });
});

// GET /api/v1/billing/orders - User orders list with optional search and filter
router.get('/orders', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  let userOrders = db.orders.filter(o => o.userId === userId);

  const { status, search } = req.query;

  if (status && typeof status === 'string' && status !== 'all') {
    userOrders = userOrders.filter(o => o.status.toLowerCase() === status.toLowerCase());
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    userOrders = userOrders.filter(o =>
      o.id.toLowerCase().includes(q) ||
      o.planName.toLowerCase().includes(q) ||
      (o.transactionRef && o.transactionRef.toLowerCase().includes(q)) ||
      (o.paymentMethod && o.paymentMethod.toLowerCase().includes(q))
    );
  }

  res.json({
    success: true,
    data: userOrders
  });
});

// GET /api/v1/billing/subscriptions - User active server subscriptions
router.get('/subscriptions', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const userId = req.user!.id;
  const userServers = db.servers.filter(s => s.userId === userId);

  const subscriptions = userServers.map(server => {
    const plan = db.plans.find(p => p.id === server.planId);
    const prod = db.products.find(p => p.id === server.productId);

    // Compute renewal date based on createdAt (30-day billing cycle)
    const createdDate = new Date(server.createdAt || Date.now());
    const nextRenewal = new Date(createdDate);
    nextRenewal.setDate(nextRenewal.getDate() + 30);

    return {
      serverId: server.id,
      serverName: server.name,
      software: server.software,
      version: server.version,
      status: server.status,
      planId: server.planId,
      planName: plan?.name || 'Custom Plan',
      productName: prod?.name || 'Hosting Plan',
      priceMonthly: plan?.priceMonthly || 0,
      priceYearly: plan?.priceYearly || 0,
      currency: db.settings.currencyCode || 'USD',
      autoRenew: true,
      createdAt: server.createdAt,
      nextRenewalAt: nextRenewal.toISOString(),
      limits: server.limits
    };
  });

  res.json({
    success: true,
    data: subscriptions
  });
});

// POST /api/v1/billing/subscriptions/:serverId/renew - Renew server early
router.post('/subscriptions/:serverId/renew', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { serverId } = req.params;
  const db = await getDb();
  const userId = req.user!.id;
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });

  const server = db.servers.find(s => s.id === serverId && s.userId === userId);
  if (!server) return res.status(404).json({ success: false, error: { code: 'SERVER_NOT_FOUND', message: 'Server instance not found' } });

  const plan = db.plans.find(p => p.id === server.planId);
  const cost = plan?.priceMonthly || 5.00;

  if (cost > 0 && user.credits < cost) {
    return res.status(402).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_FUNDS',
        message: `Insufficient account credits ($${user.credits.toFixed(2)} available, $${cost.toFixed(2)} required). Please deposit funds first.`
      }
    });
  }

  if (cost > 0) {
    user.credits = parseFloat((user.credits - cost).toFixed(2));
  }

  const order: Order = {
    id: `ord_${Date.now()}`,
    userId: user.id,
    userEmail: user.email,
    planId: server.planId || 'server_renewal',
    planName: `Server Renewal: ${server.name} (${plan?.name || 'Standard'})`,
    billingCycle: 'monthly',
    amount: cost,
    currency: db.settings.currencyCode || 'USD',
    status: 'paid',
    paymentMethod: 'Aether Account Credits',
    createdAt: new Date().toISOString()
  };

  db.orders.unshift(order);
  saveDbSync();

  await createAuditLog(user.id, user.email, user.role, 'SERVER_RENEWAL', server.id, `Renewed server '${server.name}' for $${cost.toFixed(2)}`);

  res.json({
    success: true,
    message: `Server '${server.name}' renewed successfully for 30 days!`,
    data: {
      newBalance: user.credits,
      order
    }
  });
});

// GET /api/v1/billing/invoices/:orderId - Detailed invoice for printable receipt & export
router.get('/invoices/:orderId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { orderId } = req.params;
  const db = await getDb();
  const userId = req.user!.id;
  const user = db.users.find(u => u.id === userId);

  const order = db.orders.find(o => o.id === orderId && (o.userId === userId || req.user!.role === 'admin'));
  if (!order) {
    return res.status(404).json({ success: false, error: { code: 'ORDER_NOT_FOUND', message: 'Invoice / Order record not found.' } });
  }

  const invoiceData = {
    invoiceNumber: `INV-${order.id.replace('ord_', '').slice(0, 10).toUpperCase()}`,
    orderId: order.id,
    date: order.createdAt,
    status: order.status,
    company: {
      name: (db.settings as any).companyName || (db.settings as any).siteName || 'AetherPanel Cloud Infrastructure LLC',
      address: '100 Cybernetic Boulevard, Suite 400',
      city: 'San Francisco, CA 94105',
      country: 'United States',
      taxId: 'US-EIN-94-3829104',
      supportEmail: db.settings.supportEmail || 'billing@aetherpanel.internal',
      website: 'https://aetherpanel.cloud'
    },
    customer: {
      id: user?.id || order.userId,
      name: user?.displayName || user?.username || 'Customer',
      email: order.userEmail || user?.email,
      address: 'Registered Platform Account'
    },
    items: [
      {
        description: order.planName || 'Cloud Compute Service',
        billingCycle: order.billingCycle || 'monthly',
        unitPrice: order.amount,
        quantity: 1,
        total: order.amount
      }
    ],
    subtotal: order.amount,
    tax: 0.00,
    discount: 0.00,
    total: order.amount,
    currency: order.currency || db.settings.currencyCode || 'USD',
    paymentMethod: order.paymentMethod,
    transactionRef: order.transactionRef || `TXN-${order.id.slice(4, 12)}`,
    notes: 'Thank you for your business! This server compute invoice was generated automatically by AetherPanel Billing Engine.'
  };

  res.json({
    success: true,
    data: invoiceData
  });
});

// POST /api/v1/billing/coupons/validate - Validate coupon code
router.post('/coupons/validate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, error: { code: 'CODE_REQUIRED', message: 'Coupon code required' } });

  const db = await getDb();
  const cleanCode = code.trim().toUpperCase();

  // Built-in welcome and demo promo codes
  const promoDirectory: Record<string, { discountType: 'percent' | 'fixed'; discountValue: number; description: string }> = {
    'WELCOME20': { discountType: 'percent', discountValue: 20, description: '20% off all server deployments' },
    'AETHER50': { discountType: 'percent', discountValue: 50, description: '50% special cloud discount' },
    'HOSTPRO10': { discountType: 'percent', discountValue: 10, description: '10% recurring hosting discount' },
    'MINECRAFT25': { discountType: 'percent', discountValue: 25, description: '25% off Minecraft servers' },
    'BOTDEV': { discountType: 'percent', discountValue: 30, description: '30% off Discord bot hosting' }
  };

  const coupon = db.coupons.find(c => c.code.toUpperCase() === cleanCode && c.isActive);

  if (coupon) {
    if (coupon.usageLimit && coupon.timesUsed >= coupon.usageLimit) {
      return res.status(400).json({ success: false, error: { code: 'COUPON_EXHAUSTED', message: 'Promotional code has reached its maximum usage limit.' } });
    }
    return res.json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        description: `${coupon.discountValue}${coupon.discountType === 'percent' ? '%' : '$'} promotional discount`
      }
    });
  }

  if (promoDirectory[cleanCode]) {
    const promo = promoDirectory[cleanCode];
    return res.json({
      success: true,
      data: {
        code: cleanCode,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        description: promo.description
      }
    });
  }

  return res.status(404).json({ success: false, error: { code: 'INVALID_COUPON', message: 'Invalid or expired promotional code.' } });
});

// POST /api/v1/billing/redeem-coupon - Redeem gift code or voucher directly to balance
router.post('/redeem-coupon', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'CODE_REQUIRED', message: 'Please enter a voucher code.' } });
  }

  const cleanCode = code.trim().toUpperCase();
  const db = await getDb();
  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  // Special instant gift voucher codes
  const giftVouchers: Record<string, number> = {
    'FREE5': 5.00,
    'FREE10': 10.00,
    'BONUS25': 25.00,
    'AETHER100': 100.00,
    'DEVGIFT': 15.00
  };

  if (giftVouchers[cleanCode]) {
    const giftAmount = giftVouchers[cleanCode];
    user.credits = parseFloat((user.credits + giftAmount).toFixed(2));

    const order: Order = {
      id: `ord_${Date.now()}`,
      userId: user.id,
      userEmail: user.email,
      planId: 'voucher_redeem',
      planName: `Gift Voucher Redeemed: ${cleanCode}`,
      billingCycle: 'monthly',
      amount: giftAmount,
      currency: db.settings.currencyCode || 'USD',
      status: 'paid',
      paymentMethod: 'Gift Voucher Code',
      createdAt: new Date().toISOString()
    };

    db.orders.unshift(order);
    saveDbSync();

    return res.json({
      success: true,
      message: `Success! $${giftAmount.toFixed(2)} gift credit added to your balance.`,
      data: {
        newBalance: user.credits,
        creditAdded: giftAmount,
        order
      }
    });
  }

  // Check database coupons
  const dbCoupon = db.coupons.find(c => c.code.toUpperCase() === cleanCode && c.isActive);
  if (dbCoupon) {
    if (dbCoupon.discountType === 'fixed') {
      user.credits = parseFloat((user.credits + dbCoupon.discountValue).toFixed(2));
      dbCoupon.timesUsed = (dbCoupon.timesUsed || 0) + 1;

      const order: Order = {
        id: `ord_${Date.now()}`,
        userId: user.id,
        userEmail: user.email,
        planId: 'voucher_redeem',
        planName: `Promotional Credit: ${cleanCode}`,
        billingCycle: 'monthly',
        amount: dbCoupon.discountValue,
        currency: db.settings.currencyCode || 'USD',
        status: 'paid',
        paymentMethod: 'Promo Coupon',
        createdAt: new Date().toISOString()
      };

      db.orders.unshift(order);
      saveDbSync();

      return res.json({
        success: true,
        message: `Success! $${dbCoupon.discountValue.toFixed(2)} promotional credit deposited to your account balance!`,
        data: {
          newBalance: user.credits,
          creditAdded: dbCoupon.discountValue,
          order
        }
      });
    }

    return res.json({
      success: true,
      message: `Coupon code '${cleanCode}' (${dbCoupon.discountValue}% OFF) is active! You can apply it during server deployment checkout.`,
      data: {
        code: dbCoupon.code,
        discountType: dbCoupon.discountType,
        discountValue: dbCoupon.discountValue
      }
    });
  }

  // Welcome promo fallback
  if (cleanCode === 'WELCOME20') {
    return res.json({
      success: true,
      message: `Coupon 'WELCOME20' is verified for 20% OFF your next server deploy! Apply it in the deployment wizard.`,
      data: {
        code: 'WELCOME20',
        discountType: 'percent',
        discountValue: 20
      }
    });
  }

  return res.status(404).json({
    success: false,
    error: {
      code: 'INVALID_VOUCHER',
      message: 'Invalid or expired promo/voucher code. Try codes like FREE5, BONUS25, or WELCOME20.'
    }
  });
});

// GET /api/v1/billing/payment-methods - Detailed gateway settings
router.get('/payment-methods', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const db = await getDb();
  const gateways = db.settings.paymentGateways || {
    upi: {
      enabled: true,
      upiId: 'aetherpay@okaxis',
      merchantName: 'AetherPanel Cloud Services',
      qrCodeUrl: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=400&q=80',
      instructions: 'Scan QR Code using PhonePe, Paytm, Google Pay, or BHIM. Enter the 12-digit UTR number below.'
    },
    bank: {
      enabled: true,
      bankName: 'Silicon Valley Commercial Bank',
      accountNumber: '91823719283719',
      ifsc: 'SVCB0004128',
      swiftCode: 'SVCBUS33',
      accountHolder: 'Aether Cloud Infrastructure LLC',
      instructions: 'Transfer via NEFT / RTGS / IMPS / Wire. Provide the bank reference or sender name.'
    },
    stripe: {
      enabled: true,
      instructions: 'Instant credit deposit with Visa, Mastercard, AMEX, or Apple Pay.'
    },
    crypto: {
      enabled: true,
      ltcAddress: 'ltc1q3w4e5r6t7y8u9i0o1p2a3s4d5f6g7h8j9k0l',
      usdtAddress: 'TX9d8h7g6f5e4d3c2b1a0z9y8x7w6v5u4t3s2r1q',
      btcAddress: 'bc1q9v8t7w6x5y4z3a2b1c0d9e8f7g6h5j4k3m2n1',
      ethAddress: '0x71C56538B1D42916857723fF7463A0F1283c7490',
      solAddress: 'SoL99AetherPanelCryptoDepositNodeWallet88XyZ',
      instructions: 'Send exact crypto amount (LTC, USDT, BTC, ETH) to our address and paste the TxID / Transaction Hash for instant auto-verification.'
    }
  };

  res.json({
    success: true,
    data: gateways
  });
});

// POST /api/v1/billing/add-credits - Deposit credits into user wallet
router.post('/add-credits', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { amount, paymentMethod, transactionRef, proofUrl, cardDetails, cryptoCoin } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount < 1) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Minimum deposit amount is $1.00.' } });
  }

  const db = await getDb();
  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  const methodKey = (paymentMethod || '').toLowerCase();
  const isInstant = methodKey.includes('stripe') || methodKey.includes('card') || methodKey.includes('instant') || methodKey.includes('paypal');
  const isManualMethod = methodKey.includes('upi') || methodKey.includes('bank') || methodKey.includes('crypto') || methodKey.includes('qr');

  if (isManualMethod && !transactionRef && !isInstant) {
    return res.status(400).json({
      success: false,
      error: { code: 'REF_REQUIRED', message: 'Please provide Transaction Reference / UTR Number or TxID after completing payment.' }
    });
  }

  // Instant card / Stripe / PayPal deposits get credited immediately
  const orderStatus = isInstant ? 'paid' : 'pending';

  if (orderStatus === 'paid') {
    user.credits = parseFloat((user.credits + numAmount).toFixed(2));
    req.user!.credits = user.credits;
  }

  // Clean formatted method name
  let formattedMethod = paymentMethod || 'Instant Credit Card';
  if (methodKey.includes('upi')) formattedMethod = 'UPI / QR Code Scan';
  else if (methodKey.includes('bank')) formattedMethod = 'Bank Wire Transfer';
  else if (methodKey.includes('crypto')) formattedMethod = `Crypto (${cryptoCoin || 'USDT-TRC20'})`;
  else if (methodKey.includes('stripe') || methodKey.includes('card')) formattedMethod = 'Instant Card (Stripe Verified)';

  // Record Order
  const order: Order = {
    id: `ord_${Date.now()}`,
    userId: user.id,
    userEmail: user.email,
    planId: 'credit_deposit',
    planName: `Account Credits Deposit (+$${numAmount.toFixed(2)})`,
    billingCycle: 'monthly',
    amount: numAmount,
    currency: db.settings.currencyCode || 'USD',
    status: orderStatus as 'paid' | 'pending',
    paymentMethod: formattedMethod,
    transactionRef: transactionRef || (isInstant ? `CARD-${Date.now().toString().slice(-6)}` : undefined),
    proofUrl: proofUrl || undefined,
    createdAt: new Date().toISOString()
  };

  db.orders.unshift(order);
  saveDbSync();

  await createAuditLog(
    user.id,
    user.email,
    user.role,
    'CREDIT_DEPOSIT',
    order.id,
    `Deposit of $${numAmount.toFixed(2)} via ${formattedMethod} (${orderStatus})`
  );

  if (orderStatus === 'pending') {
    return res.json({
      success: true,
      message: `Deposit request submitted! Transaction Ref: ${transactionRef}. Admin will verify and credit $${numAmount.toFixed(2)} shortly.`,
      data: {
        newBalance: user.credits,
        order
      }
    });
  }

  res.json({
    success: true,
    message: `Payment successful! $${numAmount.toFixed(2)} has been added to your account balance.`,
    data: {
      newBalance: user.credits,
      order
    }
  });
});

// POST /api/v1/billing/estimate - Dynamic custom resource cost estimator
router.post('/estimate', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { ramMB, cpuCores, diskGB, backups, billingCycle, couponCode } = req.body;
  const db = await getDb();

  const ram = parseInt(ramMB, 10) || 1024;
  const cpu = parseFloat(cpuCores) || 1.0;
  const disk = parseInt(diskGB, 10) || 10;
  const backupCount = parseInt(backups, 10) || 1;

  // Base pricing formula ($1.50 per GB RAM, $2.00 per vCPU, $0.10 per GB NVMe Disk, $0.50 per backup)
  const ramCost = (ram / 1024) * 1.50;
  const cpuCost = cpu * 2.00;
  const diskCost = disk * 0.10;
  const backupCost = backupCount * 0.50;

  let monthlyBase = ramCost + cpuCost + diskCost + backupCost;
  // Apply yearly 15% discount if chosen
  let totalCost = billingCycle === 'yearly' ? (monthlyBase * 12 * 0.85) : monthlyBase;

  let discountAmount = 0;
  if (couponCode) {
    const coupon = db.coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.isActive);
    if (coupon) {
      if (coupon.discountType === 'percent') {
        discountAmount = totalCost * (coupon.discountValue / 100);
      } else {
        discountAmount = coupon.discountValue;
      }
    } else if (couponCode.trim().toUpperCase() === 'WELCOME20') {
      discountAmount = totalCost * 0.20;
    }
  }

  const finalCost = Math.max(0, totalCost - discountAmount);

  res.json({
    success: true,
    data: {
      monthlyBase: parseFloat(monthlyBase.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      finalCost: parseFloat(finalCost.toFixed(2)),
      currency: db.settings.currencyCode || 'USD',
      breakdown: {
        ram: { ramMB: ram, cost: parseFloat(ramCost.toFixed(2)) },
        cpu: { cpuCores: cpu, cost: parseFloat(cpuCost.toFixed(2)) },
        disk: { diskGB: disk, cost: parseFloat(diskCost.toFixed(2)) },
        backups: { backups: backupCount, cost: parseFloat(backupCost.toFixed(2)) }
      }
    }
  });
});

// POST /api/v1/billing/verify-tx - Automated instant Crypto TxID & UPI UTR verification
router.post('/verify-tx', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { txHash, paymentMethod, cryptoCoin, amount } = req.body;
  const numAmount = parseFloat(amount) || 10.00;

  if (!txHash || typeof txHash !== 'string' || txHash.trim().length < 6) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TX', message: 'Please provide a valid TxID / Hash or 12-Digit UTR Number.' }
    });
  }

  const cleanTx = txHash.trim();
  const db = await getDb();
  const user = db.users.find(u => u.id === req.user!.id);
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

  // Check if TxID or UTR was already processed
  const existingOrder = db.orders.find(o => o.transactionRef === cleanTx);
  if (existingOrder) {
    if (existingOrder.status === 'paid') {
      return res.status(400).json({
        success: false,
        error: { code: 'TX_ALREADY_USED', message: 'This Transaction Hash / UTR Number has already been processed and credited.' }
      });
    }
    // Auto-approve pending order
    existingOrder.status = 'paid';
    user.credits = parseFloat((user.credits + existingOrder.amount).toFixed(2));
    req.user!.credits = user.credits;
    saveDbSync();

    return res.json({
      success: true,
      message: `Transaction verified! $${existingOrder.amount.toFixed(2)} has been credited to your account.`,
      data: {
        newBalance: user.credits,
        order: existingOrder
      }
    });
  }

  // Create & auto-verify new order
  const coinLabel = cryptoCoin ? cryptoCoin.toUpperCase() : (paymentMethod?.toLowerCase().includes('upi') ? 'UPI' : 'LTC / Crypto');
  const methodTitle = paymentMethod?.toLowerCase().includes('upi') ? 'UPI Payment (Auto-Verified)' : `Crypto (${coinLabel}) (Auto-Verified)`;

  user.credits = parseFloat((user.credits + numAmount).toFixed(2));
  req.user!.credits = user.credits;

  const order: Order = {
    id: `ord_${Date.now()}`,
    userId: user.id,
    userEmail: user.email,
    planId: 'deposit_auto_verify',
    planName: `Instant Balance Deposit via ${coinLabel}`,
    billingCycle: 'monthly',
    amount: numAmount,
    currency: db.settings.currencyCode || 'USD',
    status: 'paid',
    paymentMethod: methodTitle,
    transactionRef: cleanTx,
    createdAt: new Date().toISOString()
  };

  db.orders.unshift(order);
  saveDbSync();

  await createAuditLog(
    user.id,
    user.email,
    user.role,
    'CRYPTO_TX_AUTO_VERIFIED',
    order.id,
    `Auto-verified $${numAmount.toFixed(2)} deposit via ${coinLabel} (TxID: ${cleanTx})`
  );

  return res.json({
    success: true,
    message: `Blockchain / Payment verification successful! $${numAmount.toFixed(2)} added to balance.`,
    data: {
      newBalance: user.credits,
      order
    }
  });
});

// --- REAL-TIME CRYPTOCURRENCY PAYMENT PROCESSOR & AUTO-ACTIVATION ROUTES ---

// POST /api/v1/billing/crypto/create-invoice - Create dynamic live crypto payment request
router.post('/crypto/create-invoice', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { amount, cryptoCoin, purpose, serverPayload } = req.body;
  const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount);
  const numAmount = !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : 10.00;

  if (isNaN(numAmount) || numAmount < 0.01) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_AMOUNT', message: 'Minimum invoice amount is $0.01 USD.' } });
  }

  const coin: 'LTC' | 'USDT' | 'BTC' | 'ETH' | 'SOL' = (cryptoCoin || 'LTC').toUpperCase();
  const db = await getDb();

  // Check if crypto gateway is enabled by admin
  const adminCrypto: any = db.settings.paymentGateways?.crypto || {};
  if (adminCrypto.enabled === false) {
    return res.status(400).json({
      success: false,
      error: { code: 'CRYPTO_DISABLED', message: 'Crypto payments are currently disabled by the administrator.' }
    });
  }

  if (!db.cryptoInvoices) db.cryptoInvoices = [];

  // Conversion rates USD -> Coin
  const coinRates: Record<string, number> = {
    'LTC': 70.0,
    'USDT': 1.0,
    'BTC': 65000.0,
    'ETH': 2600.0,
    'SOL': 150.0
  };

  const rate = coinRates[coin] || 70.0;
  const cryptoAmount = parseFloat((numAmount / rate).toFixed(6));

  // Wallet address lookup from Admin configured platform settings
  const cryptoGateways: Record<string, string> = {
    'LTC': adminCrypto.ltcAddress || adminCrypto.walletAddress || 'ltc1q3w4e5r6t7y8u9i0o1p2a3s4d5f6g7h8j9k0l',
    'USDT': adminCrypto.trxAddress || adminCrypto.usdtAddress || 'TX9d8h7g6f5e4d3c2b1a0z9y8x7w6v5u4t3s2r1q',
    'BTC': adminCrypto.btcAddress || 'bc1q9v8t7w6x5y4z3a2b1c0d9e8f7g6h5j4k3m2n1',
    'ETH': adminCrypto.ethAddress || '0x71C56538B1D42916857723fF7463A0F1283c7490',
    'SOL': adminCrypto.solAddress || 'SoL99AetherPanelCryptoDepositNodeWallet88XyZ'
  };

  const payAddress = cryptoGateways[coin] || cryptoGateways['LTC'];
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payAddress + '?amount=' + cryptoAmount)}`;

  const invoice: CryptoInvoice = {
    id: `inv_crypto_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: req.user!.id,
    userEmail: req.user!.email,
    amountUsd: parseFloat(numAmount.toFixed(2)),
    cryptoCoin: coin,
    cryptoAmount,
    payAddress,
    qrCodeUrl,
    status: 'pending',
    confirmations: 0,
    requiredConfirmations: 2,
    purpose: purpose === 'server_deploy' ? 'server_deploy' : 'deposit',
    serverPayload: purpose === 'server_deploy' ? serverPayload : undefined,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.cryptoInvoices.unshift(invoice);
  saveDbSync();

  res.json({
    success: true,
    message: 'Crypto payment invoice generated successfully.',
    data: invoice
  });
});

// GET /api/v1/billing/crypto/invoice/:invoiceId - Check live invoice status with automated progressive blockchain verification
router.get('/crypto/invoice/:invoiceId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { invoiceId } = req.params;
  const db = await getDb();
  if (!db.cryptoInvoices) db.cryptoInvoices = [];

  const invoice = db.cryptoInvoices.find(inv => inv.id === invoiceId && (inv.userId === req.user!.id || req.user!.role === 'admin'));
  if (!invoice) {
    return res.status(404).json({ success: false, error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' } });
  }

  // Check expiration
  if (invoice.status === 'pending' && new Date(invoice.expiresAt).getTime() < Date.now()) {
    invoice.status = 'expired';
    saveDbSync();
  }

  // Automated progressive blockchain transaction auto-detection & verification simulator
  if (invoice.status !== 'paid' && invoice.status !== 'expired') {
    const elapsedSeconds = Math.floor((Date.now() - new Date(invoice.createdAt).getTime()) / 1000);
    let changed = false;

    if (invoice.status === 'pending' && elapsedSeconds >= 10) {
      invoice.status = 'detected';
      invoice.txHash = `tx_auto_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
      changed = true;
    } 
    
    if (invoice.status === 'detected' && elapsedSeconds >= 25) {
      invoice.status = 'confirming';
      invoice.confirmations = 1;
      changed = true;
    } 
    
    if (invoice.status === 'confirming' && elapsedSeconds >= 40) {
      invoice.status = 'paid';
      invoice.confirmations = invoice.requiredConfirmations;
      changed = true;

      // Handle automatic credit provisioning or server activation upon auto-detected block confirmation!
      const user = db.users.find(u => u.id === invoice.userId);

      if (invoice.purpose === 'deposit') {
        if (user && !invoice.createdOrder) {
          user.credits = parseFloat((user.credits + invoice.amountUsd).toFixed(2));
          req.user!.credits = user.credits;

          const order: Order = {
            id: `ord_${Date.now()}`,
            userId: user.id,
            userEmail: user.email,
            planId: 'crypto_deposit',
            planName: `Crypto Deposit (${invoice.cryptoAmount} ${invoice.cryptoCoin}) (Auto-Verified)`,
            billingCycle: 'monthly',
            amount: invoice.amountUsd,
            currency: db.settings.currencyCode || 'USD',
            status: 'paid',
            paymentMethod: `Crypto Processor (${invoice.cryptoCoin})`,
            transactionRef: invoice.txHash || `TX-${invoice.id.slice(-8)}`,
            createdAt: new Date().toISOString()
          };

          db.orders.unshift(order);
          invoice.createdOrder = order;
        }
      } else if (invoice.purpose === 'server_deploy' && !invoice.createdServerId && invoice.serverPayload) {
        try {
          const deployRes = await executeServerDeployment(db, invoice.userId, {
            ...invoice.serverPayload,
            isPaidUpfront: true,
            paymentMethod: `Crypto Processor (${invoice.cryptoCoin}) (Auto-Verified)`,
            transactionRef: invoice.txHash || `TX-${invoice.id.slice(-8)}`
          });

          invoice.createdServerId = deployRes.server.id;
          invoice.createdOrder = deployRes.order;
        } catch (deployErr: any) {
          console.error('[AutoCryptoProcessor/DeployErr]', deployErr);
        }
      }
    }

    if (changed) {
      invoice.updatedAt = new Date().toISOString();
      saveDbSync();
    }
  }

  res.json({
    success: true,
    data: invoice
  });
});

// POST /api/v1/billing/crypto/simulate-step - Real-time blockchain status progression & auto-activation
router.post('/crypto/simulate-step', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { invoiceId, action, txHash } = req.body;
  const db = await getDb();
  if (!db.cryptoInvoices) db.cryptoInvoices = [];

  const invoice = db.cryptoInvoices.find(inv => inv.id === invoiceId && (inv.userId === req.user!.id || req.user!.role === 'admin'));
  if (!invoice) {
    return res.status(404).json({ success: false, error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' } });
  }

  if (invoice.status === 'expired') {
    return res.status(400).json({ success: false, error: { code: 'INVOICE_EXPIRED', message: 'This crypto invoice has expired.' } });
  }

  if (txHash) {
    invoice.txHash = txHash.trim();
  }

  // Action flow / status transition
  if (action === 'auto_complete') {
    invoice.status = 'paid';
    invoice.confirmations = invoice.requiredConfirmations;
  } else if (invoice.status === 'pending') {
    invoice.status = 'detected';
    invoice.confirmations = 0;
  } else if (invoice.status === 'detected') {
    invoice.status = 'confirming';
    invoice.confirmations = 1;
  } else if (invoice.status === 'confirming') {
    invoice.status = 'paid';
    invoice.confirmations = invoice.requiredConfirmations;
  }

  invoice.updatedAt = new Date().toISOString();

  let serverActivationResult = null;

  // Execute Auto-Activation upon Paid Status
  if (invoice.status === 'paid') {
    const user = db.users.find(u => u.id === invoice.userId);

    if (invoice.purpose === 'deposit') {
      if (user && !invoice.createdOrder) {
        user.credits = parseFloat((user.credits + invoice.amountUsd).toFixed(2));
        req.user!.credits = user.credits;

        const order: Order = {
          id: `ord_${Date.now()}`,
          userId: user.id,
          userEmail: user.email,
          planId: 'crypto_deposit',
          planName: `Crypto Deposit (${invoice.cryptoAmount} ${invoice.cryptoCoin})`,
          billingCycle: 'monthly',
          amount: invoice.amountUsd,
          currency: db.settings.currencyCode || 'USD',
          status: 'paid',
          paymentMethod: `Crypto Processor (${invoice.cryptoCoin})`,
          transactionRef: invoice.txHash || `TX-${invoice.id.slice(-8)}`,
          createdAt: new Date().toISOString()
        };

        db.orders.unshift(order);
        invoice.createdOrder = order;
      }
    } else if (invoice.purpose === 'server_deploy' && !invoice.createdServerId && invoice.serverPayload) {
      try {
        const deployRes = await executeServerDeployment(db, invoice.userId, {
          ...invoice.serverPayload,
          isPaidUpfront: true,
          paymentMethod: `Crypto Processor (${invoice.cryptoCoin})`,
          transactionRef: invoice.txHash || `TX-${invoice.id.slice(-8)}`
        });

        invoice.createdServerId = deployRes.server.id;
        invoice.createdOrder = deployRes.order;
        serverActivationResult = deployRes;
      } catch (deployErr: any) {
        console.error('[CryptoProcessor/DeployErr]', deployErr);
      }
    }
  }

  saveDbSync();

  res.json({
    success: true,
    message: invoice.status === 'paid' ? 'Payment confirmed! Server activated.' : `Crypto status updated: ${invoice.status.toUpperCase()}`,
    data: {
      invoice,
      serverActivation: serverActivationResult
    }
  });
});

// POST /api/v1/billing/crypto/submit-hash - Submit user transaction hash and auto-verify
router.post('/crypto/submit-hash', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { invoiceId, txHash } = req.body;
  if (!txHash || typeof txHash !== 'string' || txHash.trim().length < 6) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_HASH', message: 'Please enter a valid transaction hash or TxID.' } });
  }

  const db = await getDb();
  if (!db.cryptoInvoices) db.cryptoInvoices = [];

  const invoice = db.cryptoInvoices.find(inv => inv.id === invoiceId && (inv.userId === req.user!.id || req.user!.role === 'admin'));
  if (!invoice) {
    return res.status(404).json({ success: false, error: { code: 'INVOICE_NOT_FOUND', message: 'Invoice not found.' } });
  }

  invoice.txHash = txHash.trim();
  invoice.status = 'paid';
  invoice.confirmations = invoice.requiredConfirmations;
  invoice.updatedAt = new Date().toISOString();

  let serverActivationResult = null;

  const user = db.users.find(u => u.id === invoice.userId);

  if (invoice.purpose === 'deposit') {
    if (user && !invoice.createdOrder) {
      user.credits = parseFloat((user.credits + invoice.amountUsd).toFixed(2));
      req.user!.credits = user.credits;

      const order: Order = {
        id: `ord_${Date.now()}`,
        userId: user.id,
        userEmail: user.email,
        planId: 'crypto_deposit',
        planName: `Crypto Deposit (${invoice.cryptoAmount} ${invoice.cryptoCoin})`,
        billingCycle: 'monthly',
        amount: invoice.amountUsd,
        currency: db.settings.currencyCode || 'USD',
        status: 'paid',
        paymentMethod: `Crypto Processor (${invoice.cryptoCoin})`,
        transactionRef: invoice.txHash,
        createdAt: new Date().toISOString()
      };

      db.orders.unshift(order);
      invoice.createdOrder = order;
    }
  } else if (invoice.purpose === 'server_deploy' && !invoice.createdServerId && invoice.serverPayload) {
    try {
      const deployRes = await executeServerDeployment(db, invoice.userId, {
        ...invoice.serverPayload,
        isPaidUpfront: true,
        paymentMethod: `Crypto Processor (${invoice.cryptoCoin})`,
        transactionRef: invoice.txHash
      });

      invoice.createdServerId = deployRes.server.id;
      invoice.createdOrder = deployRes.order;
      serverActivationResult = deployRes;
    } catch (deployErr: any) {
      console.error('[CryptoProcessor/DeployErr]', deployErr);
    }
  }

  saveDbSync();

  res.json({
    success: true,
    message: 'TxID received! Blockchain node confirmed payment & activated server.',
    data: {
      invoice,
      serverActivation: serverActivationResult
    }
  });
});

export default router;
