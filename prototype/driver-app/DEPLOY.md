# Deploy Driver App Prototype lên Render (Static Site)

Hướng dẫn publish prototype **Driver App** (`prototype/driver-app/index.html`) thành **một static service riêng** trên Render — tách biệt với prototype `car-truck-manager`.

> Prototype là 1 file HTML thuần (không build, không backend). Render chỉ cần serve thư mục tĩnh.

---

## 0. Yêu cầu trước

- Code đã được **commit & push** lên branch `staging` (hoặc `main`) của repo `amoeba-devops/ambAppStore`.
- Có tài khoản Render đã kết nối với GitHub repo này (giống lúc deploy `car-truck-manager-prototype`).

---

## Cách A — Tạo Static Site qua Dashboard (khuyến nghị, giống prototype hiện có)

1. Vào **https://dashboard.render.com** → **New +** → **Static Site**.
2. Chọn repo **`amoeba-devops/ambAppStore`** → **Connect**.
3. Điền cấu hình:

   | Trường | Giá trị |
   |--------|---------|
   | **Name** | `driver-app-prototype` |
   | **Branch** | `staging` |
   | **Root Directory** | `prototype/driver-app` |
   | **Build Command** | `echo "No build needed"` |
   | **Publish Directory** | `.` |

4. **Create Static Site**. Render clone repo, vào `prototype/driver-app`, serve thư mục đó.
5. Sau ~30–60s sẽ có URL: `https://driver-app-prototype.onrender.com`.
   Trang mở thẳng `index.html`.

> **Root Directory = `prototype/driver-app`** là điểm mấu chốt để Render chỉ serve folder này, không đụng tới phần còn lại của monorepo.

---

## Cách B — Blueprint bằng `render.yaml` (đã kèm sẵn)

File [`render.yaml`](render.yaml) đã có sẵn trong thư mục này:

```yaml
services:
  - type: web
    name: driver-app-prototype
    env: static
    buildCommand: echo "No build needed"
    staticPublishPath: .
    headers:
      - path: /*
        name: Cache-Control
        value: public, max-age=3600
```

Khi dùng Blueprint, Render đọc `render.yaml` **từ Root Directory đã chỉ định**, nên vẫn cần đặt **Root Directory = `prototype/driver-app`**:

1. Dashboard → **New +** → **Blueprint**.
2. Chọn repo → branch `staging` → **Root Directory** = `prototype/driver-app`.
3. Render phát hiện `render.yaml` → **Apply** → tạo service `driver-app-prototype`.

> Lưu ý: repo này có nhiều `render.yaml` (mỗi prototype một file). Vì vậy **luôn set Root Directory**, đừng để Render quét nhầm file ở root/prototype khác.

---

## Auto-deploy

- Mặc định Render bật **Auto-Deploy**: mỗi lần push lên branch đã chọn (`staging`) → tự build lại.
- Vì là static + 1 file, deploy gần như tức thời.

---

## Kiểm tra sau khi deploy

Mở URL và xác nhận:

- [ ] Toggle **Xe con / Xe tải** đổi màu (xanh ↔ cam) và nội dung.
- [ ] Switcher **VI / EN / KO** (chip góc phải app bar + control trên) đổi toàn bộ chữ.
- [ ] 4 tab dưới: **Hôm nay · Chuyến của tôi · Ghi nhận chi phí · Tôi**.
- [ ] Deep-link hoạt động, ví dụ:
  `…onrender.com/#theme=truck&state=active&screen=tripsMine&lang=ko`

---

## Gỡ lỗi nhanh

| Triệu chứng | Nguyên nhân / Cách xử lý |
|-------------|--------------------------|
| 404 / trang trắng | Sai **Root Directory** hoặc **Publish Directory**. Đặt Root = `prototype/driver-app`, Publish = `.` |
| Deploy ra prototype khác | Render quét nhầm `render.yaml`. Kiểm tra lại Root Directory của service. |
| Sửa code không thấy đổi | CDN cache (`max-age=3600`). Hard-refresh (Ctrl+Shift+R) hoặc bấm **Clear cache & deploy** trên Render. |
| Font/icon không hiện | Prototype dùng Google Fonts CDN — cần mạng ra ngoài. Không ảnh hưởng layout. |

---

## Gỡ service

Dashboard → service `driver-app-prototype` → **Settings** → **Delete Service**.
