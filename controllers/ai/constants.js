const categoryLabels = {
  books:        'Sách & Giáo trình',
  electronics:  'Điện tử & Máy tính',
  clothing:     'Quần áo & Thời trang',
  furniture:    'Nội thất & Đồ dùng phòng trọ',
  'daily-needs':'Đồ dùng hàng ngày',
  sports:       'Thể thao & Gym',
  gaming:       'Giải trí & Sở thích',
  other:        'Khác',
};

const conditionContext = {
  new:        'mới 100%, chưa qua sử dụng, còn nguyên hộp/tem',
  'like-new': 'như mới, chỉ dùng 1-2 lần, không có vết xước hay hư hỏng',
  good:       'đã qua sử dụng nhưng vẫn hoạt động tốt, có thể có vài dấu hiệu sử dụng nhỏ',
  fair:       'đã dùng nhiều, có thể có vết xước nhỏ nhưng vẫn dùng được bình thường',
};

function buildPrompt({ title, category, condition, priceNote, locationNote, categoryLabels, conditionContext }) {
  return `Bạn là chuyên gia viết mô tả sản phẩm cho sàn mua bán đồ sinh viên Campus Marketplace.

Thông tin sản phẩm:
- Tên sản phẩm: ${title}
- Danh mục: ${categoryLabels[category] || category || 'Khác'}
- Tình trạng: ${conditionContext[condition] || condition || 'Không rõ'}
${priceNote}
${locationNote}

Yêu cầu bắt buộc:
1. Viết bằng tiếng Việt, giọng văn tự nhiên như người thật đang rao bán — KHÔNG cứng nhắc như template
2. Độ dài: 3-5 câu (80-120 từ) — đủ thông tin, không lan man
3. Phải đề cập tình trạng thực tế một cách cụ thể (không chỉ nói "tình trạng tốt")
4. Nêu rõ lý do bán hợp lý (ví dụ: ra trường, đổi máy, không dùng nữa...)
5. Nhấn mạnh 1-2 điểm nổi bật khiến người mua muốn chốt đơn ngay
6. Kết thúc bằng lời kêu gọi hành động ngắn gọn (ví dụ: "Ib ngay để được giá tốt nhất!" hoặc "Deal nhanh kẻo hết!")
7. KHÔNG dùng emoji
8. KHÔNG viết tiêu đề hay nhãn — chỉ viết phần mô tả thuần túy

Ví dụ mô tả HAY (học theo phong cách này):
"Mình cần bán lại bộ giáo trình Giải tích 1-2 dùng hồi năm nhất, sách còn rất mới, chỉ gạch chân vài chỗ quan trọng thôi. Mua lại với giá gốc 280k nhưng giờ bán lại 120k vì ra học kỳ mới rồi không cần nữa. Sách đầy đủ cả hai cuốn, không rách trang, chữ in rõ nét. Bạn nào đang học Bách Khoa hoặc Kinh tế ib mình nhé, có thể gặp trao tay ngay tại thư viện trường!"

Bây giờ hãy viết mô tả cho sản phẩm trên:`;
}

module.exports = { categoryLabels, conditionContext, buildPrompt };
