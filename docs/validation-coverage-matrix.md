# Validation Coverage Matrix (VAL-001)

Audit date: 2026-05-22

## Scope

All mutable API routes (`POST`, `PATCH`, `PUT`, `DELETE`) under `routes/*`.

## Summary

- Total mutable routes: 33
- Routes protected by body/schema validation middleware: 30
- Upload routes protected by upload-specific validation middleware: 3
- Coverage: 33/33 = 100%
- Critical object-id params are now validated before controller/service access on products, orders, chat, payments, notifications, and admin moderation routes.
- Critical list/filter querystrings are now validated/coerced on products, orders, ratings, notifications, wallet history, and admin list endpoints.

Validation middleware in use:
1. `validate(schema)` (Zod body validation)
2. `validateUploadRequest` (multipart upload validation for file/mime/size/no-extra-fields)
3. `validateParams(schema)` (Zod params validation)
4. `validateQuery(schema)` (Zod querystring validation/coercion)

## Route matrix

| Route | Method | Validation |
|---|---|---|
| `/api/auth/logout` | POST | `validate(emptyBodySchema)` |
| `/api/auth/refresh` | POST | `validate(emptyBodySchema)` |
| `/api/auth/profile` | PATCH | `validate(authUpdateProfileSchema)` |
| `/api/chat/init` | POST | `validate(chatInitSchema)` |
| `/api/chat/:id/messages` | POST | `validate(chatSendMessageSchema)` |
| `/api/orders` | POST | `validate(createOrderSchema)` |
| `/api/orders/:id/status` | PATCH | `validate(updateOrderStatusSchema)` |
| `/api/orders/:id/dispute` | POST | `validate(openDisputeSchema)` |
| `/api/orders/:id/dispute/resolve` | POST | `validate(resolveDisputeSchema)` |
| `/api/products` | POST | `validate(createProductSchema)` |
| `/api/products/:id` | PATCH | `validate(updateProductSchema)` |
| `/api/products/:id/mark-sold` | POST | `validate(emptyBodySchema)` |
| `/api/products/:id/relist` | POST | `validate(emptyBodySchema)` |
| `/api/products/:id` | DELETE | `validate(emptyBodySchema)` |
| `/api/products/:id/interested` | POST | `validate(emptyBodySchema)` |
| `/api/ratings` | POST | `validate(ratingSubmitSchema)` |
| `/api/ratings` | DELETE | `validate(ratingDeleteSchema)` |
| `/api/report` | POST | `validate(reportCreateSchema)` |
| `/api/wallet/payout-request` | POST | `validate(payoutRequestSchema)` |
| `/api/ai/describe` | POST | `validate(aiDescribeSchema)` |
| `/api/payments/webhook` | POST | `validate(paymentWebhookSchema)` |
| `/api/admin/users/:id/ban` | PATCH | `validate(adminToggleBanSchema)` |
| `/api/admin/reports/:id` | PATCH | `validate(adminUpdateReportSchema)` |
| `/api/admin/payouts/:id/approve` | POST | `validate(adminPayoutApproveSchema)` |
| `/api/admin/payouts/:id/mark-paid` | POST | `validate(adminPayoutMarkPaidSchema)` |
| `/api/admin/payouts/:id/reject` | POST | `validate(adminPayoutRejectSchema)` |
| `/api/admin/settings` | POST | `validate(adminSettingsSchema)` |
| `/api/admin/products/:id/hide` | PATCH | `validate(emptyBodySchema)` |
| `/api/admin/products/:id/restore` | PATCH | `validate(emptyBodySchema)` |
| `/api/admin/products/:id` | DELETE | `validate(emptyBodySchema)` |
| `/api/admin/sync-ratings` | POST | `validate(emptyBodySchema)` |
| `/api/upload/image` | POST | `validateUploadRequest` |
| `/api/upload/avatar` | POST | `validateUploadRequest` |
| `/api/upload/chat` | POST | `validateUploadRequest` |

## Params and query coverage (VAL-201)

| Surface | Routes | Validation |
|---|---|---|
| Product IDs | `/api/products/:id`, `/api/products/:id/status`, mark-sold, relist, delete, interested | `validateParams(idParamSchema)` |
| Product list filters | `/api/products`, `/api/products/my`, `/api/products/favorites` | `validateQuery(productFeedQuerySchema/productSellerQuerySchema/favoriteQuerySchema)` |
| Order IDs | `/api/orders/:id`, status, dispute, dispute resolve | `validateParams(idParamSchema)` |
| Order list/role filters | `/api/orders`, `/api/orders/stats`, `/api/orders/analytics` | `validateQuery(orderListQuerySchema/orderRoleQuerySchema/orderAnalyticsQuerySchema)` |
| Chat conversation IDs | `/api/chat/:id/messages` | `validateParams(idParamSchema)` |
| Payment IDs | `/api/payments/:id/status`, `/api/payments/:paymentId/check` | `validateParams(idParamSchema/paymentIdParamSchema)` |
| Notification IDs and filters | `/api/notifications`, `/api/notifications/:id/read`, `/api/notifications/:id` | `validateQuery(notificationsQuerySchema)`, `validateParams(idParamSchema)` |
| Wallet history pagination | `/api/wallet/transactions`, `/api/wallet/payout-requests` | `validateQuery(paginationQuerySchema)` |
| Rating entity queries | `/api/ratings`, `/api/ratings/user-rating`, `/api/ratings/stats` | `validateQuery(ratingEntityQuerySchema)` |
| Admin list/moderation surface | users, orders, products, reports, payouts, product actions | `validateQuery(admin*QuerySchema)`, `validateParams(idParamSchema)` |

Automated evidence: `npm run test:validation:request`.

