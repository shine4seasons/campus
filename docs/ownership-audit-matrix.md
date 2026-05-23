# Ownership Audit Matrix (SEC-004)

Audit date: 2026-05-22

## Scope

Object-by-id endpoints in API and page routes that can expose user-specific or transaction-specific data.

## Results

| Endpoint | Auth required | Ownership/Admin scope | Status | Notes |
|---|---|---|---|---|
| `GET /api/payments/:id/status` | Yes | Buyer-scoped query (`buyer = req.user._id`) | PASS | Returns 404 for non-owner. |
| `GET /api/payments/:paymentId/check` | Yes | Buyer/Seller/Admin check in service | PASS | Patched in SEC-004. |
| `PATCH /api/notifications/:id/read` | Yes | Recipient-scoped update (`_id + recipient`) | PASS | Patched in SEC-004. |
| `DELETE /api/notifications/:id` | Yes | Recipient-scoped delete (`_id + recipient`) | PASS | Already scoped. |
| `GET /api/orders/:id` | Yes | Buyer/Seller/Admin check | PASS | Returns 403 if unauthorized. |
| `PATCH /api/orders/:id/status` | Yes | Buyer/Seller/Admin check in service | PASS | Transition guard by role. |
| `POST /api/orders/:id/dispute` | Yes | Buyer/Seller check | PASS | Non-party blocked with 403. |
| `POST /api/orders/:id/dispute/resolve` | Yes | Admin-only | PASS | Route + controller guard. |
| `GET /api/chat/:id/messages` | Yes | Participant-scoped conversation query | PASS | Forbidden/missing logged. |
| `POST /api/chat/:id/messages` | Yes | Participant-scoped conversation query | PASS | Forbidden/missing logged. |
| `PATCH /api/products/:id` | Yes | Seller/Admin check | PASS | Non-owner blocked with 403. |
| `POST /api/products/:id/mark-sold` | Yes | Seller/Admin check | PASS | Non-owner blocked with 403. |
| `POST /api/products/:id/relist` | Yes | Seller/Admin check | PASS | Non-owner blocked with 403. |
| `DELETE /api/products/:id` | Yes | Seller/Admin check | PASS | Non-owner blocked with 403. |
| `GET /checkout/payment/:paymentId` | Yes | Buyer-only check | PASS | Non-owner blocked with 403 page. |
| `GET /orders/tracking/:orderId` | Yes | Buyer/Seller/Admin check | PASS | Non-party blocked with 403 page. |
| `GET /api/admin/*/:id/*` | Yes | Admin-only (`restrictTo('admin')`) | PASS | Guarded at router level. |

## Residual risk

No remaining cross-user data-access path was identified in current object-by-id endpoint set.
