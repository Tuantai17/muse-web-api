---
title: Muse Web Api
emoji: ⚡
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# Muse Web API Gateway

> **OpenAI-Compatible Gateway for Muse.ai**  
> Chuyển đổi tài khoản Muse.ai thành API chuẩn OpenAI (`/v1/chat/completions`, `/v1/models`) với giao diện quản trị Dashboard trực quan.

---

## 🌟 Tính năng nổi bật

- ⚡ **Chuẩn OpenAI API**: Tương thích trực tiếp với các thư viện OpenAI SDK, LangChain, Next.js, Chatbox, LibreChat, API Chat Studio...
- 🌐 **Trình duyệt tự động (Headless Chromium)**: Tự động điều khiển phiên làm việc qua giao diện web `muse.ai/thread/new`.
- 📊 **Dashboard Quản trị Hiện đại**: Quản lý tài khoản, cập nhật token trực tiếp, giám sát lưu lượng và tạo API key cá nhân.
- 🔄 **Tự động làm mới phiên**: Tự động gia hạn cookie và kết nối máy ảo để luôn sẵn sàng xử lý yêu cầu.
- 🐳 **Triển khai đa nền tảng**: Hỗ trợ chạy Docker trên Hugging Face Spaces (miễn phí), VPS Linux, hoặc máy tính cá nhân.

---

## 🚀 Triển khai nhanh

### 1. Triển khai miễn phí trên Hugging Face Spaces
1. Đăng nhập vào [Hugging Face](https://huggingface.co) và chọn **New Space**.
2. Chọn **Space SDK: Docker** (Blank).
3. Kết nối với repository GitHub này hoặc clone mã nguồn lên Space.
4. Hugging Face sẽ tự động build từ `Dockerfile` và khởi chạy trên port `7860`.

### 2. Chạy với Docker Compose (VPS / Server riêng)
```bash
git clone https://github.com/Tuantai17/muse-web-api.git
cd muse-web-api
cp .env.example .env
docker compose up -d --build
```

---

## ⚙️ Cấu hình Biến môi trường

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `MUSE2API_HOST` | `0.0.0.0` | Địa chỉ IP lắng nghe |
| `MUSE2API_PORT` | `18610` (hoặc `7860`) | Cổng dịch vụ |
| `MUSE2API_DRIVER` | `browser` | Driver xử lý (`browser`, `http`, `mock`) |
| `MUSE2API_API_KEY` | *(Tự tạo)* | Master API Key truy cập `/v1/*` |
| `MUSE2API_ADMIN_KEY` | *(Tự tạo)* | Khóa quản trị truy cập `/dashboard` |

---

## 📖 Hướng dẫn sử dụng

1. Truy cập giao diện quản trị tại: `http://localhost:18610/dashboard` (hoặc domain Hugging Face của bạn).
2. Vào mục **Accounts**, thêm tài khoản Muse bằng cookie `hatch_sess`.
3. Vào mục **API Keys**, sao chép API Key cá nhân để sử dụng trong ứng dụng của bạn.

---

## 📄 Bản quyền
Phát hành theo giấy phép [MIT](LICENSE).
