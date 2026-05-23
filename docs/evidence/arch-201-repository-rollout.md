# ARCH-201 Repository Rollout Evidence

Date: 2026-05-23
Status: In progress
Status: Completed

## Scope completed in this pass

Repository modules added:
- `repositories/productRepository.js`
- `repositories/orderRepository.js`
- `repositories/chatRepository.js`
- `repositories/walletRepository.js`
- `repositories/notificationRepository.js`
- `repositories/paymentRepository.js`
- `repositories/ratingRepository.js`
- `repositories/adminRepository.js`
- `repositories/authRepository.js`
- `repositories/pageRepository.js`

API controllers moved to repository-backed data access:
- `controllers/product/index.js`
- `controllers/orders/index.js`
- `controllers/orders/dispute.js`
- `controllers/chat/index.js`
- `controllers/chat/conversation.js`
- `controllers/walletController.js`
- `controllers/notificationController.js`
- `controllers/checkout/index.js`
- `controllers/rating/index.js`
- `controllers/admin/index.js`
- `controllers/auth/index.js`
- `controllers/pageController.js`

## Verification

Checks run:
- `node --check controllers/product/index.js`
- `node --check controllers/orders/index.js`
- `node --check controllers/orders/dispute.js`
- `node --check controllers/chat/index.js`
- `node --check controllers/chat/conversation.js`
- `node --check controllers/walletController.js`
- `node --check controllers/notificationController.js`
- `node --check controllers/checkout/index.js`
- `node --check controllers/rating/index.js`
- `node --check controllers/admin/index.js`
- `node --check repositories/paymentRepository.js`
- `node --check repositories/ratingRepository.js`
- `node --check repositories/adminRepository.js`
- `node --check repositories/authRepository.js`
- `node --check repositories/pageRepository.js`
- `node scripts/test-architecture-repositories.js`

Result:
- All syntax checks passed.
- `scripts/test-architecture-repositories.js` passed and confirmed repository usage across the extracted controllers.

## Remaining direct model usage

The current controller-model inventory is snapshotted in `docs/evidence/arch-201-controller-model-usage.txt`.

Highest-value remaining extraction targets:
- None for top-level controller query ownership in extracted scope.

Notes:
- The remaining hits in `controllers/product/index.js` are instance-level `populate()` and `deleteOne()` calls on already loaded documents, not controller-owned top-level query construction.
- Remaining page data-assembly complexity should be handled under `ARCH-202` service-boundary work.
