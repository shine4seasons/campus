# Campus Marketplace - Test Plan & Cases

This document outlines the test cases for the Campus Marketplace system, organized by module.

## 1. Authentication & User Profile
| ID | Test Case | Expected Result | Priority |
|:---|:---|:---|:---|
| AUTH-01 | Register with valid student email | Account created, redirected to homepage. | High |
| AUTH-02 | Register with invalid email format | Error message displayed; registration blocked. | Medium |
| AUTH-03 | Login with correct credentials | Successful login; user redirected to intended page. | High |
| AUTH-04 | Login with incorrect password | Error message displayed; login denied. | High |
| AUTH-05 | Reset password flow | Reset link sent to email; password can be updated. | Medium |
| AUTH-06 | Update profile info (Name, Bio, Avatar) | Changes saved and reflected in profile view. | Low |
| AUTH-07 | Logout | Session destroyed; user redirected to login page. | High |

## 2. Product Management (Seller)
| ID | Test Case | Expected Result | Priority |
|:---|:---|:---|:---|
| PROD-01 | Create listing with all required fields | Product saved and visible in marketplace. | High |
| PROD-02 | Create listing with missing price/title | Form validation blocks submission. | High |
| PROD-03 | Upload multiple product images | Images uploaded and displayed correctly in gallery. | Medium |
| PROD-04 | Edit existing listing | Updates reflected immediately on product page. | Medium |
| PROD-05 | Mark product as "Sold" | Product status updated; hidden from search or marked sold. | High |
| PROD-06 | Delete product listing | Product removed from database and marketplace. | Medium |
| PROD-07 | Generate AI description | AI generates relevant text based on title/category. | Low |

## 3. Browsing & Searching (Buyer)
| ID | Test Case | Expected Result | Priority |
|:---|:---|:---|:---|
| SEARCH-01 | Global search by keyword | Relevant products displayed based on title/description. | High |
| SEARCH-02 | Filter products by category | Only products in the selected category are shown. | Medium |
| SEARCH-03 | Filter by price range | Results narrowed down to products within the range. | Medium |
| SEARCH-04 | View product details | All info (images, description, location) loads correctly. | High |
| SEARCH-05 | Toggle "Interested" (Heart icon) | Interest count updates; item added to user's saved list. | Low |

## 4. Chat & Communication
| ID | Test Case | Expected Result | Priority |
|:---|:---|:---|:---|
| CHAT-01 | Initialize chat from product page | New conversation created with product context banner. | High |
| CHAT-02 | Send real-time text message | Message appears instantly for both parties via Socket.io. | High |
| CHAT-03 | View message history | Previous messages load correctly in the chat window. | Medium |
| CHAT-04 | Unread message notifications | Badge updates in navbar/sidebar for new messages. | Medium |
| CHAT-05 | Switch between conversations | Chat window updates with correct context and messages. | Medium |

## 5. Orders & Checkout
| ID | Test Case | Expected Result | Priority |
|:---|:---|:---|:---|
| ORD-01 | Place order for a product | Order created; seller notified; product status updated. | High |
| ORD-02 | View order history (Buyer/Seller) | Orders listed with correct status and details. | Medium |
| ORD-03 | Update order status (Processing/Shipping) | Status changes reflected in order tracking. | Medium |
| ORD-04 | Cancel an order | Order cancelled; stock/status reverted if applicable. | High |

## 6. Ratings & Reports
| ID | Test Case | Expected Result | Priority |
|:---|:---|:---|:---|
| RATE-01 | Rate a seller after purchase | Rating saved; seller's average rating updated. | Medium |
| RATE-02 | Review a product | Comment and star rating visible on product page. | Medium |
| REP-01 | Report an inappropriate listing | Report submitted to admin for review. | Medium |
| REP-02 | Report a suspicious user | User flagged in the system for admin investigation. | Medium |

## 7. Admin Features
| ID | Test Case | Expected Result | Priority |
|:---|:---|:---|:---|
| ADMIN-01 | Manage users (Ban/Unban) | User access restricted or restored. | High |
| ADMIN-02 | Manage products (Remove/Approve) | Listings controlled by admin. | High |
| ADMIN-03 | Review reports | Reports listed and can be marked as resolved. | Medium |
| ADMIN-04 | View system analytics | Charts/Stats load with correct database data. | Low |
