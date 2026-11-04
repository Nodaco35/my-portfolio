# Giải Thích Chi Tiết Nguyên Nhân Lỗi School List Tại Frontend

Tài liệu này ghi lại chi tiết nguyên nhân kỹ thuật khiến Frontend (`FoodPrintFE`) không lấy được danh sách trường học tại Header và Platform Homepage dù Backend API đã trả về dữ liệu thành công.

---

## 1. Bản chất Kỹ thuật của Sự cố

Sự cố bắt nguồn từ **sự không tương thích kiểu dữ liệu (Type Mismatch)** giữa cấu trúc Envelope chuẩn của Backend và kỳ vọng dữ liệu ở tầng Component của Frontend.

### 1.1. Cấu trúc Response của Backend (Chuẩn `AGENTS.md`)
Khi module `organization` (School) được chuẩn hóa theo `AGENTS.md`, endpoint công khai `GET /api/schools/public` trả về cấu trúc **Envelope chuẩn có phân trang**:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lấy danh sách trường học thành công",
  "data": {
    "items": [
      {
        "id": "a1b2c3d4-0001-4000-8000-000000000001",
        "code": "SCH_ANH_DUONG",
        "name": "Trường Tiểu học Ánh Dương",
        "address": "Số 18 Phố Nguyễn Phong Sắc, Cầu Giấy, Hà Nội",
        "district": "Cầu Giấy",
        "city": "Hà Nội",
        "status": "ACTIVE"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1,
      "hasNext": false
    }
  }
}
```

### 1.2. Cơ chế xử lý của Axios Interceptor trên Frontend
Trong file cấu hình [`src/services/01_axios/index.js`](src/services/01_axios/index.js), interceptor nhận HTTP Response và bóc tách tầng ngoài cùng:

```javascript
// src/services/01_axios/index.js (dòng 30-33)
instance.interceptors.response.use(
  response => {
    return response.data; // Trả về toàn bộ body JSON của Backend
  },
  ...
);
```

Điều này có nghĩa là khi Component gọi `const res = await SchoolService.getPublicSchools()`, biến `res` nhận được chính là toàn bộ JSON Envelope:
* `res.success` = `true`
* `res.statusCode` = `200`
* `res.data` = `{ items: [...], pagination: {...} }` $\rightarrow$ **ĐÂY LÀ MỘT OBJECT, HOÀN TOÀN KHÔNG PHẢI MẢNG (ARRAY)**.

---

## 2. Chi tiết Từng Điểm Gãy tại các Component

### 2.1. Tại `PublicHeader.jsx` và `SchoolHeader.jsx`
Cả hai component Header đều viết đoạn code nạp dữ liệu như sau:

```javascript
// PublicHeader.jsx (dòng 33-36) & SchoolHeader.jsx (dòng 30-33)
const res = await SchoolService.getPublicSchools();
if (isMounted && res?.data) {
  setSchools(Array.isArray(res.data) ? res.data : []);
}
```

* **Cơ chế lỗi:** 
  - `res.data` là một Object `{ items: [...], pagination: {...} }`.
  - Biểu thức `Array.isArray(res.data)` trả về kết quả **`false`**.
  - Do đó toán tử 3 ngôi rơi vào nhánh thứ hai: `setSchools([])` $\rightarrow$ gán state `schools` thành **mảng rỗng**!
  - Hậu quả: Menu dropdown "Khám phá trường học" hoặc "Chọn trường" không có bất kỳ phần tử nào để render.

---

### 2.2. Tại `PlatformHome/index.jsx` và `SchoolDiscovery.jsx`
Tại trang chủ nền tảng (`PlatformHome`):

```javascript
// PlatformHome/index.jsx (dòng 19-22)
const res = await SchoolService.getPublicSchools();
if (isMounted && res?.data) {
  setSchools(res.data); // Gán thẳng Object { items: [...], pagination: {...} } vào state schools
}
```

State `schools` bây giờ mang giá trị là một **Object**.
1. **Lỗi hiển thị rỗng:** 
   Trong component con [`SchoolDiscovery.jsx`](src/pages/ANONYMOUS/PlatformHome/component/SchoolDiscovery.jsx#L50):
   ```jsx
   {schools.length > 0 ? (
     schools.map(school => <SchoolCard key={school.id} school={school} />)
   ) : (
     <div className={styles.emptyState}>Chưa có dữ liệu trường học</div>
   )}
   ```
   Do `schools` là Object, thuộc tính `schools.length` mang giá trị `undefined`. Phép so sánh `undefined > 0` trả về `false`, khiến giao diện luôn rơi vào nhánh hiển thị *"Chưa có dữ liệu trường học"*.

2. **Lỗi Crash Runtime khi tìm kiếm:**
   Trong `PlatformHome/index.jsx` (dòng 40):
   ```javascript
   const filteredSchools = useMemo(() => {
     if (!searchQuery.trim()) return schools;
     const query = searchQuery.toLowerCase().trim();
     return schools.filter(item => ...); // CRASH TẠI ĐÂY
   }, [schools, searchQuery]);
   ```
   Khi người dùng bắt đầu gõ ký tự vào ô tìm kiếm, hàm `schools.filter(...)` được kích hoạt. Vì `schools` là một Object (không có phương thức `.filter` của Array), ứng dụng ném ra ngoại lệ nghiêm trọng:
   ```text
   Uncaught TypeError: schools.filter is not a function
   ```

---

## 3. Tại sao Mock Data Trước Đây Lại Che Giấu Lỗi Này?

Trong giai đoạn phát triển ban đầu, file [`src/services/SchoolService/mockData.js`](src/services/SchoolService/mockData.js) khai báo:

```javascript
export const MOCK_SCHOOLS = [
  { id: "a1b2...", name: "Trường Tiểu học Ánh Dương", ... },
  { id: "a1b2...", name: "Trường Tiểu học Hoa Sen", ... }
];
```

Khi bật cờ `isUseMock = true`, hàm mock trả về trực tiếp mảng thô `MOCK_SCHOOLS`. Khi đó:
* `res.data` chính là `MOCK_SCHOOLS` (một `Array`).
* Phép kiểm tra `Array.isArray(res.data)` trả về `true`.
* `schools.length` trả về `2 > 0`.
* `schools.filter(...)` chạy mượt mà.

$\rightarrow$ **Kết luận:** Mock data trả về mảng phẳng thô, hoàn toàn không phản ánh đúng hợp đồng API (API Contract) thực tế của Backend chuẩn Enterprise (luôn bọc trong Envelope `{ items, pagination }`). 
Khi component có cơ chế tự động fallback sang mock khi API lỗi, nó sẽ "lấp liếm" mọi lỗi 4xx/5xx/mất kết nối của Backend, khiến lập trình viên tưởng rằng code đang chạy tốt nhưng thực chất API đã chết hoặc payload bị sai cấu trúc.

---

## 4. Giải Pháp và Quy Chuẩn Khắc Phục (Best Practice)

Để đảm bảo vừa hiển thị đúng dữ liệu thật, vừa có khả năng phát hiện lỗi lập tức:

### 4.1. Lớp 1: Chuẩn hóa bóc tách tại Service (`SchoolService/index.js`)
Service kiểm tra nếu `res.data` là Envelope có chứa thuộc tính `items` thì tự động nâng `items` lên `res.data`, đồng thời giữ lại `res.pagination`:

```javascript
const getPublicSchoolsApi = async (params = {}) => {
  const res = await http.get(apiGetPublicSchools, { params, skipAuthRedirect: true });
  if (res?.data && !Array.isArray(res.data) && Array.isArray(res.data.items)) {
    return {
      ...res,
      data: res.data.items,
      pagination: res.data.pagination,
    };
  }
  return res;
};
```
* **Không dùng mock fallback**: Nếu API lỗi, ném lỗi ra ngoài để component biết và báo lỗi.

### 4.2. Lớp 2: Lập trình phòng thủ tại Component (Defensive Extraction)
Tại mọi Component tiêu thụ danh sách trường học:
```javascript
const res = await SchoolService.getPublicSchools();
if (isMounted) {
  const schoolList = Array.isArray(res?.data)
    ? res.data
    : (Array.isArray(res?.data?.items) ? res.data.items : []);
  setSchools(schoolList);
}
```
Và trong khối `catch (err)`:
```javascript
catch (err) {
  console.error("Lỗi khi tải danh sách trường:", err);
}
```
Lỗi sẽ được log chi tiết lên Console trình duyệt với đầy đủ stack trace, giúp việc debug diễn ra tức thì và minh bạch.
