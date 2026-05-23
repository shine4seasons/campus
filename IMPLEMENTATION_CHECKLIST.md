# SePay Payment Confirmation - Implementation Checklist

## Pre-Implementation

- [ ] Get SePay API key from dashboard
- [ ] Confirm Node.js, MongoDB, and backend are running
- [ ] Confirm latest code is pulled

## Environment Setup

- [ ] Create `.env`
- [ ] Set `SEPAY_API_KEY`
- [ ] Ensure `.env` is ignored by git
- [ ] Restart server

## Backend Verification

- [ ] `models/Payment.js` has `bankTransactionId`
- [ ] `controllers/checkout/payment.js` has `checkPaymentViaSePay()`
- [ ] `routes/paymentRoutes.js` has `GET /:paymentId/check`
- [ ] `npm run lint` passes

## Frontend Verification

- [ ] `views/payment.ejs` polls `/check`
- [ ] Polling interval is 3000ms
- [ ] No browser console errors

## Endpoint Test

- [ ] Start server
- [ ] Create test order and payment
- [ ] Call `GET /api/payments/:paymentId/check` with session cookie
- [ ] Confirm response shape and status

## End-to-End Verification

- [ ] Checkout flow reaches QR page
- [ ] Transfer with exact amount and memo
- [ ] Payment confirms automatically
- [ ] Redirect to order tracking works
- [ ] Order becomes `PROCESSING`
- [ ] Seller notification is sent

## Security Checklist

- [ ] API key only in backend env
- [ ] Endpoint requires auth
- [ ] Amount and payment code are validated exactly
- [ ] Duplicate transactions are blocked
- [ ] Error responses do not leak sensitive internals

## Monitoring Checklist

- [ ] Track payment confirmation success rate
- [ ] Track confirmation latency
- [ ] Track SePay API error rate
- [ ] Alert on key failures (`SEPAY_API_KEY`, high 5xx, long confirmation)

## Deployment

- [ ] Deploy code
- [ ] Set production env vars
- [ ] Restart service
- [ ] Verify production payment flow

## Final Checklist

- [ ] All automated checks pass
- [ ] Run `npm run test:gates` and confirm all checks are green
- [ ] Run `npm run bench:p95 -- --endpoints=/api/products,/api/chat,/api/orders` on running env and save output
- [ ] Run `npm run test:concurrency:runtime` with seeded scenario on running env and save output
- [ ] Payment flow passes manual verification
- [ ] Security checklist is complete
- [ ] Docs are up to date

## Next Steps

- [ ] Add long-run monitoring dashboards
- [ ] Add periodic replay/duplicate payment drills
