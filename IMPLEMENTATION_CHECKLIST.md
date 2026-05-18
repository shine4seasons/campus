# SePay Payment Confirmation - Implementation Checklist

## 📋 Pre-Implementation

### Step 1: Get SePay API Key (5 minutes)
- [ ] Go to https://dashboard.sepay.vn/
- [ ] Login to your SePay account
- [ ] Navigate to API Settings
- [ ] Generate new API key (name: "Smart Campus Marketplace")
- [ ] Copy full API key to safe location
- [ ] Test API key with curl command

### Step 2: Verify Your Setup
- [ ] Node.js v14+ installed
- [ ] MongoDB running and connected
- [ ] Express.js server running
- [ ] Latest code pulled from repository
- [ ] No uncommitted changes in working directory

## 🔧 Implementation Steps

### Step 3: Environment Configuration (5 minutes)
- [ ] Create `.env` file in project root
- [ ] Add `SEPAY_API_KEY=your_key`
- [ ] Add `SEPAY_API_KEY` to `.gitignore`
- [ ] Verify `.env` file not in git: `git check-ignore .env`
- [ ] Restart server to load `.env`

```bash
# Create .env
cat > .env << EOF
SEPAY_API_KEY=your_actual_sepay_api_key_here
NODE_ENV=development
EOF

# Add to gitignore
echo ".env" >> .gitignore

# Verify
git status  # .env should not appear
```

### Step 4: Verify Backend Implementation (10 minutes)
- [ ] Open `models/Payment.js` - verify `bankTransactionId` field exists
- [ ] Open `controllers/checkout/payment.js` - verify `checkPaymentViaSePay()` method exists
- [ ] Open `routes/paymentRoutes.js` - verify new route `GET /:paymentId/check` exists
- [ ] Check if any syntax errors: `npm run lint` (if available)

```bash
# Quick verification
grep -n "bankTransactionId" models/Payment.js
grep -n "checkPaymentViaSePay" controllers/checkout/payment.js
grep -n "paymentId/check" routes/paymentRoutes.js
```

### Step 5: Verify Frontend Implementation (5 minutes)
- [ ] Open `views/payment.ejs` - verify polling uses new endpoint `/check`
- [ ] Verify comments added explaining SePay integration
- [ ] Verify polling interval is 3000ms
- [ ] No console errors in browser dev tools

### Step 6: Test Payment Endpoint (10 minutes)
- [ ] Start server: `npm start`
- [ ] Create test order
- [ ] Generate QR payment
- [ ] Get paymentId from payment page
- [ ] Manually test endpoint:

```bash
# Get your session cookie first
# Then test endpoint
curl -X GET "http://localhost:3000/api/payments/YOUR_PAYMENT_ID/check" \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"

# Expected response (if PENDING)
# {
#   "success": true,
#   "status": "PENDING",
#   "message": "Payment check in progress"
# }
```

### Step 7: End-to-End Test (15 minutes)
- [ ] Open browser and go to product page
- [ ] Click "Buy Now"
- [ ] Complete checkout
- [ ] See QR payment page
- [ ] Verify polling indicator shows "Checking payment..."
- [ ] Create test transfer in SePay with:
  - Bank: BIDV
  - Account: 8818879421
  - Amount: Exact from QR
  - Memo: Exact paymentCode from QR
- [ ] Watch payment status update automatically (3-5 seconds)
- [ ] Verify redirect to order tracking page
- [ ] Verify order status is PROCESSING
- [ ] Verify seller got notification

## 📊 Verification Tests

### Test 1: Payment Confirmation
```
Expected: Payment confirmed within 3-5 seconds
Result: ✅ PASS / ❌ FAIL
```

### Test 2: Duplicate Prevention
```
Steps:
1. Create payment
2. Transfer money
3. Payment confirms
4. Try to transfer same amount again
Expected: Second transfer not processed
Result: ✅ PASS / ❌ FAIL
```

### Test 3: Amount Validation
```
Steps:
1. Create payment for 100000 VND
2. Transfer 99999 VND with correct memo
Expected: Payment stays PENDING
Result: ✅ PASS / ❌ FAIL
```

### Test 4: Payment Code Validation
```
Steps:
1. Create payment with code SCM_ORDER_123
2. Transfer 100000 VND with memo "WRONG_CODE"
Expected: Payment stays PENDING
Result: ✅ PASS / ❌ FAIL
```

### Test 5: Payment Expiry
```
Steps:
1. Create payment (expires in 15 min)
2. Wait and don't transfer
3. Poll after 15 minutes
Expected: Payment marked EXPIRED
Result: ✅ PASS / ❌ FAIL
```

### Test 6: Seller Notification
```
Steps:
1. Create and confirm payment
Expected: Seller gets notification immediately
Result: ✅ PASS / ❌ FAIL
```

### Test 7: Wallet Update
```
Steps:
1. Create and confirm payment
Expected: Seller wallet balance increases
Result: ✅ PASS / ❌ FAIL
```

### Test 8: Order Status
```
Steps:
1. Create and confirm payment
Expected: Order status changes to PROCESSING
Result: ✅ PASS / ❌ FAIL
```

## 🔐 Security Checklist

- [ ] SEPAY_API_KEY in .env (not in code)
- [ ] .env not committed to git
- [ ] SePay API called only on backend
- [ ] Payment endpoint requires authentication
- [ ] Amount validated exactly
- [ ] PaymentCode validated exactly
- [ ] Duplicate transactions prevented
- [ ] No sensitive data in frontend responses
- [ ] Error messages don't leak info
- [ ] Logs don't print full API key

```bash
# Verify security
grep -r "SEPAY_API_KEY" . --exclude-dir=.git  # Should only find in .env
grep -r "process.env.SEPAY_API_KEY" routes/  # Should only be in backend routes
grep -r "SEPAY_API_KEY" views/  # Should NOT find in EJS templates
```

## 📈 Monitoring Checklist

### Logs to Monitor
- [ ] SePay API calls successful
- [ ] Payment confirmations logged
- [ ] No "bankTransactionId already processed" errors
- [ ] No "SEPAY_API_KEY" in logs (security)
- [ ] No duplicate confirmations
- [ ] Error rate < 1%

```bash
# Check logs
tail -f server.log | grep "SePay"
tail -f server.log | grep "Payment"
tail -f server.log | grep "ERROR"
```

### Metrics to Track
- [ ] Payment confirmation rate (target: >99%)
- [ ] Average confirmation time (target: <5 seconds)
- [ ] SePay API latency (target: <500ms)
- [ ] Polling error rate (target: <0.1%)
- [ ] Duplicate attempt rate (target: 0%)

### Alerts to Set Up
- [ ] SEPAY_API_KEY missing or invalid
- [ ] SePay API down (500+ errors)
- [ ] High error rate in payment checks (>5%)
- [ ] Payment confirmation taking >30 seconds
- [ ] Duplicate transaction detected

## 🚀 Deployment

### Before Deployment
- [ ] All tests passing
- [ ] No console errors
- [ ] No security issues
- [ ] Documentation reviewed
- [ ] Team trained on new flow
- [ ] Rollback plan in place

### Deployment Steps
```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies (if needed)
npm install

# 3. Set environment variables in production
# SSH into production server and update .env
# SEPAY_API_KEY=prod_key_here

# 4. Restart server
pm2 restart app
# or
systemctl restart nodejs-app

# 5. Verify it's running
pm2 logs app
# or
systemctl status nodejs-app
```

### Post-Deployment
- [ ] Payment flow working
- [ ] Payments confirming automatically
- [ ] Seller notifications working
- [ ] No error spikes in logs
- [ ] Database records created correctly
- [ ] Wallet balances updating
- [ ] Order statuses updating

## 🆘 Troubleshooting Guide

### Issue: "SEPAY_API_KEY not set"

**Solution:**
1. Check .env file exists
2. Verify SEPAY_API_KEY=your_key in .env
3. Restart server
4. Check error still occurs

### Issue: SePay API returns 401

**Solution:**
1. Verify API key is valid (copy from dashboard)
2. Check key has "Read Transactions" permission
3. Generate new key if expired
4. Update .env and restart

### Issue: Payments stay PENDING

**Solution:**
1. Verify transfer amount matches exactly
2. Verify transfer memo matches paymentCode exactly
3. Check SePay transaction appears in API
4. Check server logs for errors

### Issue: Duplicate payments processed

**Solution:**
1. This shouldn't happen (bankTransactionId prevents it)
2. If it does, check database for corrupted records
3. Contact technical support

### Issue: Seller didn't get notification

**Solution:**
1. Check payment status is PAID
2. Check notification service working
3. Check seller's notification settings
4. Check logs for notification errors

## 📚 Documentation Review

- [ ] Read `SEPAY_QUICK_REFERENCE.md` (5 min read)
- [ ] Read `SEPAY_POLLING_SETUP.md` (30 min read)
- [ ] Read `SEPAY_INTEGRATION_EXAMPLES.md` (15 min read)
- [ ] Read `ENV_SETUP.md` (10 min read)
- [ ] Read `SEPAY_IMPLEMENTATION_COMPLETE.md` (15 min read)

## ✅ Final Checklist

### Code
- [ ] Payment model has bankTransactionId
- [ ] Controller has checkPaymentViaSePay method
- [ ] Routes include new /check endpoint
- [ ] Frontend uses new endpoint
- [ ] No console errors
- [ ] No TypeScript errors (if using TS)

### Environment
- [ ] .env file created
- [ ] SEPAY_API_KEY set
- [ ] .env in .gitignore
- [ ] .env not in git history

### Testing
- [ ] Payment endpoint responds
- [ ] Payment confirms automatically
- [ ] Duplicate prevention working
- [ ] Amount validation working
- [ ] PaymentCode validation working
- [ ] Expiry handling working
- [ ] Seller notifications working
- [ ] Wallet updates working
- [ ] Order status updates working

### Security
- [ ] No API key in frontend
- [ ] No API key in logs
- [ ] No API key in git
- [ ] Authentication required on endpoint
- [ ] Validation working on both fields
- [ ] Duplicates prevented

### Documentation
- [ ] All files documented
- [ ] README updated
- [ ] Team trained
- [ ] Support docs available

### Deployment
- [ ] Code deployed to production
- [ ] Environment variables set in production
- [ ] Server restarted
- [ ] Payment flow verified in production
- [ ] Monitoring set up
- [ ] Alerts configured
- [ ] Rollback plan ready

## 🎉 Success Criteria

Your implementation is successful when:

✅ Payments are confirmed automatically (no manual action)
✅ Confirmation happens within 3-5 seconds
✅ Duplicate payments are prevented
✅ Seller receives notification immediately
✅ Order status updates to PROCESSING
✅ Wallet balance increases correctly
✅ No security vulnerabilities
✅ <1% error rate
✅ All tests passing
✅ Production deployment successful

## 📞 Next Steps

If you encounter issues:

1. Check `SEPAY_QUICK_REFERENCE.md` troubleshooting
2. Review server logs: `tail -f server.log | grep "SePay"`
3. Test SePay API directly with curl
4. Check MongoDB records
5. Verify environment variables
6. Contact technical support if needed

---

**Implementation Date:** _______________
**Completed By:** _______________
**Verified By:** _______________
**Deployed To Production:** _______________
