# Hướng dẫn sử dụng tính năng "My Orders" cho Buyer

## Tổng quan

Hệ thống đã được nâng cấp với các trang mới cho phép người mua (buyer) xem danh sách đơn hàng, theo dõi trạng thái đơn hàng, hủy đơn hàng, và xem bản đồ quãng đường từ người mua đến người bán.

## Các trang mới

### 1. Trang "My Orders" (`/orders`)
**URL:** `http://localhost:5000/orders`

**Chức năng:**
- Xem danh sách tất cả đơn hàng mà người dùng đã đặt
- Hiển thị bộ đếm trạng thái đơn hàng ở đầu trang
  - Pending (Chờ xác nhận)
  - Confirmed (Đã xác nhận)
  - Completed (Hoàn thành)
  - Cancelled (Đã hủy)
- Lọc đơn hàng theo trạng thái bằng các nút "Filter Pills"
- Thông tin đơn hàng trên mỗi card:
  - Hình ảnh sản phẩm
  - Tên sản phẩm
  - ID đơn hàng
  - Thông tin người bán (avatar, nickname)
  - Giá tiền
  - Phương thức giao hàng (Shipping/Pickup)
  - Phương thức thanh toán (Card/Cash)
  - Ngày đặt hàng
  - Trạng thái hiện tại
- Nút hành động:
  - **"Track Order"** - Chuyển đến trang theo dõi chi tiết
  - **"Cancel Order"** - Hủy đơn hàng (chỉ khả dụng khi trạng thái là "Pending")

### 2. Trang "Order Tracking" (`/orders/tracking/:orderId`)
**URL:** `http://localhost:5000/orders/tracking/{OrderId}`

**Chức năng:**

#### Phần bên trái - Bản đồ và khoảng cách
- **Bản đồ tương tác** hiển thị:
  - Marker xanh dương: Vị trí của bạn (Buyer)
  - Marker xanh lá: Vị trí người bán (Seller)
  - Đường nô (vàng): Đường nối giữa hai vị trí
  - Huyền thoại (Legend) giải thích các marker
  
- **Tính toán khoảng cách:**
  - Dùng công thức Haversine để tính khoảng cách chính xác trên cầu
  - Hiển thị khoảng cách kilomet (km)
  - Ước tính thời gian giao hàng (`×5 phút/km` cho xe máy)
  
- **Thông tin giao hàng:**
  - Phương thức giao hàng (Shipping hoặc Pickup)
  - Nếu là Shipping: hiển thị địa chỉ giao hàng đầy đủ

#### Phần bên phải - Chi tiết và Timeline
- **Thông tin đơn hàng:**
  - Sản phẩm (link đến trang chi tiết sản phẩm)
  - Giá tiền
  - Phương thức thanh toán
  - Ngày đặt hàng bao gồm giờ phút
  - Ghi chú (nếu có)

- **Timeline trạng thái (Status Timeline):**
  - Hiển thị 3-4 bước chính trong chu kỳ đơn hàng
  - ✓ Order Placed (Đơn hàng được đặt)
  - ✓ Order Confirmed (Đơn hàng được xác nhận)
  - ✓ Order Completed (Đơn hàng hoàn thành)
  - ✕ Order Cancelled (Đơn hàng bị hủy) - nếu có
  - Mỗi bước hiển thị ngày giờ đã hoàn thành hoặc trạng thái hiện tại

- **Thông tin người bán:**
  - Avatar
  - Tên/Nickname
  - Số điện thoại (nếu có)
  - Nút "💬 Message Seller" - Mở cửa sổ chat với người bán

## Điều hướng từ Sidebar

Khi ở **Buyer Mode**:
1. Mở sidebar bên trái
2. Tìm phần "My Activities"
3. Click vào **"My Orders"** để vào trang danh sách đơn hàng
4. Hoặc click **"Messages"** để xem tin nhắn

## Cách hủy đơn hàng

1. Vào trang "My Orders" (`/orders`)
2. Tìm đơn hàng có trạng thái **"Pending"**
3. Click nút **"Cancel Order"**
4. Xác nhận hủy đơn hàng trong hộp thoại (dialog)
5. Trang sẽ tự động làm mới, trạng thái sẽ thay đổi thành "Cancelled"

**Lưu ý:** 
- Chỉ có thể hủy đơn hàng khi trạng thái là "Pending"
- Khi hủy đơn hàng, sản phẩm sẽ quay lại trạng thái "active" để bán lại
- Các bộ đếm (totalSales, totalOrders) sẽ được điều chỉnh lại

## Bản đồ và tính toán khoảng cách

### Công nghệ sử dụng:
- **Leaflet.js**: Thư viện bản đồ miễn phí, mã nguồn mở
- **OpenStreetMap**: Dữ liệu bản đồ từ cộng đồng
- **Haversine Formula**: Công thức tính khoảng cách giữa hai điểm trên cầu
- **Leaflet Routing Machine** (tùy chọn): Lập lộ trình chi tiết

### Tính năng bản đồ:
1. **Hiển thị vị trí:**
   - Vị trí người mua được lấy từ `req.user.location` (lat/lng)
   - Vị trí người bán được lấy từ `order.seller.location` (lat/lng)
   - Nếu không có tọa độ, sẽ sử dụng tọa độ mặc định (TPHCM)

2. **Tính toán quãng đường:**
   - Công thức: R = 6371 km (bán kính Trái Đất)
   - Tính góc Δlat, Δlon
   - Dùng công thức Haversine để được khoảng cách chính xác

3. **Ước tính thời gian:**
   - Tốc độ trung bình: 12 km/h (xe máy)
   - Thời gian = (khoảng cách / 12) × 60 phút

## Cấu trúc dữ liệu

### Order Document:
```javascript
{
  _id: ObjectId,
  product: ObjectId(ref: "Product"),
  buyer: ObjectId(ref: "User"),
  seller: ObjectId(ref: "User"),
  priceSnapshot: Number,
  deliveryMode: "pickup" | "ship",
  paymentMode: "cash" | "card",
  shippingAddress: {
    name: String,
    phone: String,
    street: String,
    district: String,
    city: String
  },
  note: String,
  status: "pending" | "confirmed" | "completed" | "cancelled",
  conversation: ObjectId(ref: "Conversation"),
  confirmedAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### User Location:
```javascript
{
  location: {
    lat: Number,  // Latitude
    lng: Number   // Longitude
  }
}
```

## API Endpoints sử dụng

### 1. Lấy danh sách đơn hàng của buyer
```
GET /api/orders?role=buyer
```
**Response:**
```json
{
  "success": true,
  "data": [{ order objects }]
}
```

### 2. Hủy đơn hàng
```
PATCH /api/orders/:id/status
Content-Type: application/json

{
  "status": "cancelled"
}
```
**Response:**
```json
{
  "success": true,
  "data": { updated order object }
}
```

### 3. Lấy chi tiết đơn hàng
```
GET /api/orders/:id
```
**Response:**
```json
{
  "success": true,
  "data": {
    _id: String,
    product: { title, images, price, ... },
    buyer: { name, nickname, avatar, phone, location, ... },
    seller: { name, nickname, avatar, phone, location, ... },
    priceSnapshot: Number,
    status: String,
    ...
  }
}
```

## Lưu ý quan trọng

1. **Quyền truy cập:**
   - Chỉ có buyer của đơn hàng mới có thể xem chi tiết
   - Seller cũng có thể xem chi tiết của đơn hàng của họ
   - Admin có thể xem bất kỳ đơn hàng nào

2. **Vị trí (Location):**
   - Phải cập nhật `location.lat` và `location.lng` trong User model
   - Hiện tại mặc định sử dụng tọa độ TPHCM (10.7769, 106.7009)

3. **CSS:**
   - Tất cả styles được include trong `orders-buyer.ejs` và `order-tracking.ejs`
   - Một file CSS riêng cũng được tạo: `/public/css/orders.css`

4. **Responsive Design:**
   - Trang được tối ưu hóa cho mobile và desktop
   - Bản đồ tự động điều chỉnh kích thước theo màn hình

## Troubleshooting

### Bản đồ không hiển thị
- Kiểm tra kết nối internet (Leaflet cần tải tiles từ OpenStreetMap)
- Kiểm tra console cho lỗi CORS
- Xác nhận rằng `location.lat` và `location.lng` không phải null

### Khoảng cách hiển thị không chính xác
- Kiểm tra tọa độ được lưu trong database
- Xác nhận công thức Haversine đang chạy đúng
- Trong console, kiểm tra giá trị `distance` được tính

### Nút "Cancel Order" không hoạt động
- Xác nhận trạng thái đơn hàng là "pending"
- Kiểm tra network tab trong DevTools xem API call có thành công không
- Xác nhận `/api/orders/:id/status` endpoint đang hoạt động

### Sidebar không hiển thị "My Orders"
- Xác nhận đang ở "Buyer Mode" (check localStorage: `campus_mode = 'buyer'`)
- Click nút "Buyer" trong sidebar mode toggle nếu cần
- Reload trang

## Tương lai (Enhancements tùy chọn)

1. Real-time location tracking với WebSockets
2. Tích hợp dịch vụ thanh toán để cập nhật trạng thái đơn hàng tự động
3. Gán delivery partner cho đơn hàng
4. Hệ thống đánh giá/nhận xét đơn hàng
5. Cho phép chỉnh sửa địa chỉ giao hàng
6. Thông báo push khi thay đổi trạng thái đơn hàng
