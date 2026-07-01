/**
 * Content for the TRUCK user guide (vi + ko). Consumed by build-truck-guide.mjs.
 * Bodies are HTML; {LANG} in a figure src is swapped per language at build time.
 * Kept factual to the shipped UI (see the referenced screenshots).
 */
export function CONTENT({ fig, intro }) {
  const M = 'truck-manager';
  const D = 'truck-driver';
  return [
    // ── MANAGER ────────────────────────────────────────────────────────────
    {
      section: M, slug: '00-tong-quan', route: '/truck/dashboard',
      vi: {
        title: 'Xe tải — Tổng quan phân hệ Quản lý', navTitle: 'Tổng quan', crumb: 'Xe tải · Quản lý · Tổng quan',
        body: [
          intro([
            ['Dành cho', '<strong>Quản trị viên</strong> và <strong>Quản lý</strong> có quyền phòng <strong>Xe tải</strong>'],
            ['Mục đích', 'Ghi nhật ký chuyến hàng, quản lý đội xe theo khu vực, theo dõi chi phí – doanh thu – lợi nhuận và lập báo cáo tháng'],
            ['Giao diện', 'Chủ đề màu <strong>cam</strong> (phân biệt với phòng Xe con màu xanh)'],
          ]),
          '<p>Phòng <strong>Xe tải</strong> phục vụ vận tải hàng hoá: mỗi chuyến là một <strong>nhật ký chuyến (LOG)</strong> ghi lại khách hàng, tuyến đường, số liệu nhiên liệu – cầu đường – doanh thu. Khác phòng Xe con (điều phối đưa đón, có bước tài xế chấp nhận/từ chối), phòng Xe tải tập trung vào <strong>ghi nhận &amp; kết toán chi phí</strong> theo từng chuyến và từng khu vực.</p>',
          fig(M, '01-dashboard', 'Bảng điều khiển Xe tải — chủ đề cam, lọc theo khu vực'),
          '<h2>Vào phòng Xe tải bằng cách nào?</h2><ul><li><strong>Quản lý chỉ phụ trách Xe tải</strong> — đăng nhập là vào thẳng.</li><li><strong>Quản trị viên (cả 2 phòng)</strong> — dùng nút <strong>chuyển phòng Xe con / Xe tải</strong> ở đầu thanh bên. <em>Chỉ Quản trị viên</em> mới thấy và chuyển được.</li></ul>',
          '<h2>Bản đồ menu</h2><ul><li><strong>Vận hành</strong> — Bảng điều khiển · Nhật ký chuyến · Đội xe · Tài xế</li><li><strong>Tài chính</strong> — Chi phí &amp; Lợi nhuận (kèm Tổng quan P&amp;L)</li><li><strong>Báo cáo</strong> — Lập báo cáo · Danh sách báo cáo</li></ul>',
          '<h2>3 khu vực</h2><p>Mỗi xe tải thuộc một khu vực: <strong>HCM</strong>, <strong>Đồng Nai</strong> hoặc <strong>Baiksan</strong>. Khu vực của một chuyến chính là khu vực của xe chạy chuyến đó — dùng để lọc bảng điều khiển, tính P&amp;L và lập báo cáo.</p>',
        ].join('\n'),
      },
      ko: {
        title: '트럭 — 관리자 화면 개요', navTitle: '개요', crumb: '트럭 · 관리자 · 개요',
        body: [
          intro([
            ['대상', '<strong>트럭</strong> 부서 권한이 있는 <strong>관리자</strong> 및 <strong>매니저</strong>'],
            ['목적', '화물 운행 일지 기록, 지역별 차량 관리, 비용·매출·손익 추적 및 월간 보고서 작성'],
            ['테마', '<strong>주황색</strong> 테마 (승용차 부서의 파란색과 구분)'],
          ]),
          '<p><strong>트럭</strong> 부서는 화물 운송 업무를 위한 것입니다. 각 운행은 고객·경로·연료·통행료·매출을 기록하는 <strong>운행 일지(LOG)</strong>입니다. 배차·수락/거절이 있는 승용차 부서와 달리, 트럭 부서는 운행별·지역별 <strong>비용 기록 및 정산</strong>에 중점을 둡니다.</p>',
          fig(M, '01-dashboard', '트럭 대시보드 — 주황색 테마, 지역별 필터'),
          '<h2>트럭 부서 진입 방법</h2><ul><li><strong>트럭 전담 매니저</strong> — 로그인하면 바로 진입합니다.</li><li><strong>관리자(양쪽 부서)</strong> — 사이드바 상단의 <strong>승용차 / 트럭 전환</strong> 버튼 사용. <em>관리자만</em> 보이고 전환할 수 있습니다.</li></ul>',
          '<h2>메뉴 구성</h2><ul><li><strong>운영</strong> — 대시보드 · 운행 일지 · 차량 · 기사</li><li><strong>재무</strong> — 비용 &amp; 손익 (손익 개요 포함)</li><li><strong>보고서</strong> — 보고서 작성 · 보고서 목록</li></ul>',
          '<h2>3개 지역</h2><p>각 트럭은 <strong>HCM</strong>, <strong>동나이</strong>, <strong>Baiksan</strong> 중 한 지역에 속합니다. 운행의 지역은 그 운행을 수행한 차량의 지역이며, 대시보드 필터·손익·보고서에 사용됩니다.</p>',
        ].join('\n'),
      },
    },
    {
      section: M, slug: '01-bang-dieu-khien', route: '/truck/dashboard',
      vi: {
        title: 'Bảng điều khiển Xe tải', navTitle: 'Bảng điều khiển', crumb: 'Xe tải · Quản lý · Bảng điều khiển',
        body: [
          intro([['URL', '<code>/truck/dashboard</code> — trang chủ khi vào phòng Xe tải'], ['Kỳ dữ liệu', 'Chọn ở góc phải (mặc định <strong>Tháng này</strong>)']]),
          fig(M, '01-dashboard', 'Bảng điều khiển — 4 chỉ số, biểu đồ, cơ cấu chi phí, bảng khu vực'),
          '<h2>Lọc theo khu vực</h2><p>Hàng nút <strong>Tất cả · HCM · Đồng Nai · Baiksan</strong> ở trên cùng lọc toàn bộ số liệu trong trang theo khu vực đang chọn.</p>',
          '<h2>4 chỉ số chính</h2><ul><li><strong>Doanh thu</strong> — tổng doanh thu các chuyến trong kỳ</li><li><strong>Tổng chi phí</strong> — nhiên liệu + cầu đường + phát sinh + chi phí cố định</li><li><strong>Lợi nhuận ròng</strong> — doanh thu − tổng chi phí</li><li><strong>Số chuyến</strong> — số chuyến hoàn thành trong kỳ</li></ul><p>Mỗi chỉ số kèm mức <strong>so với kỳ trước</strong> (▲/▼ %).</p>',
          '<h2>Biểu đồ &amp; bảng</h2><ul><li><strong>Doanh thu &amp; lợi nhuận theo tháng</strong> — cột theo từng tháng</li><li><strong>Cơ cấu chi phí</strong> — vòng tròn tỉ trọng (nhiên liệu, cầu đường, …)</li><li><strong>Theo khu vực</strong> — bảng doanh thu / lợi nhuận / số chuyến từng khu vực</li></ul>',
          fig(M, '01-dashboard-mobile', 'Bảng điều khiển trên điện thoại — các thẻ xếp dọc'),
        ].join('\n'),
      },
      ko: {
        title: '트럭 대시보드', navTitle: '대시보드', crumb: '트럭 · 관리자 · 대시보드',
        body: [
          intro([['URL', '<code>/truck/dashboard</code> — 트럭 부서 진입 시 첫 화면'], ['기간', '우측 상단에서 선택 (기본 <strong>이번 달</strong>)']]),
          fig(M, '01-dashboard', '대시보드 — 4개 지표, 차트, 비용 구성, 지역 표'),
          '<h2>지역별 필터</h2><p>상단의 <strong>전체 · HCM · 동나이 · Baiksan</strong> 버튼으로 화면 전체 수치를 선택한 지역 기준으로 필터링합니다.</p>',
          '<h2>4개 핵심 지표</h2><ul><li><strong>매출</strong> — 기간 내 운행 매출 합계</li><li><strong>총비용</strong> — 연료 + 통행료 + 기타 + 고정비</li><li><strong>순이익</strong> — 매출 − 총비용</li><li><strong>운행 수</strong> — 기간 내 완료 운행 수</li></ul><p>각 지표에는 <strong>전기 대비</strong> 증감(▲/▼ %)이 표시됩니다.</p>',
          '<h2>차트 &amp; 표</h2><ul><li><strong>월별 매출 &amp; 이익</strong> — 월별 막대</li><li><strong>비용 구성</strong> — 항목별 비중 도넛</li><li><strong>지역별</strong> — 지역별 매출/이익/운행 수 표</li></ul>',
          fig(M, '01-dashboard-mobile', '휴대폰 대시보드 — 카드 세로 배치'),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '02-nhat-ky-chuyen', route: '/truck/trips',
      vi: {
        title: 'Nhật ký chuyến', navTitle: 'Nhật ký chuyến', crumb: 'Xe tải · Quản lý · Nhật ký chuyến',
        body: [
          intro([['URL', '<code>/truck/trips</code>'], ['Nội dung', 'Danh sách tất cả nhật ký chuyến (LOG) của phòng Xe tải']]),
          fig(M, '02-trips-list', 'Danh sách nhật ký chuyến — bảng trên desktop'),
          '<h2>Thông tin mỗi dòng</h2><p>Mã chuyến, khách hàng, tuyến (điểm đi → điểm đến), xe, tài xế, trạng thái và doanh thu. Bấm một dòng để mở <a href="04-chi-tiet-chuyen.html">chi tiết chuyến</a>.</p>',
          '<h2>Trạng thái chuyến</h2><ul><li><strong>Chờ hoàn thành</strong> — đã tạo, chờ tài xế ghi số liệu</li><li><strong>Đang chạy</strong> — chuyến đang thực hiện</li><li><strong>Hoàn thành</strong> — đã ghi đủ nhiên liệu/cầu đường/doanh thu</li></ul>',
          '<h2>Tạo &amp; nhập</h2><p>Nút <strong>Lập chuyến</strong> mở form tạo mới (xem <a href="03-lap-chuyen.html">Lập chuyến</a>). Trên điện thoại danh sách hiển thị dạng thẻ thay cho bảng.</p>',
        ].join('\n'),
      },
      ko: {
        title: '운행 일지', navTitle: '운행 일지', crumb: '트럭 · 관리자 · 운행 일지',
        body: [
          intro([['URL', '<code>/truck/trips</code>'], ['내용', '트럭 부서의 모든 운행 일지(LOG) 목록']]),
          fig(M, '02-trips-list', '운행 일지 목록 — 데스크톱 표'),
          '<h2>각 행 정보</h2><p>운행 번호, 고객, 경로(출발 → 도착), 차량, 기사, 상태, 매출. 행을 클릭하면 <a href="04-chi-tiet-chuyen.html">운행 상세</a>가 열립니다.</p>',
          '<h2>운행 상태</h2><ul><li><strong>완료 대기</strong> — 생성됨, 기사 기록 대기</li><li><strong>운행 중</strong> — 진행 중</li><li><strong>완료</strong> — 연료/통행료/매출 기록 완료</li></ul>',
          '<h2>생성 &amp; 가져오기</h2><p><strong>운행 등록</strong> 버튼으로 새 운행을 만듭니다(<a href="03-lap-chuyen.html">운행 등록</a>). 휴대폰에서는 표 대신 카드로 표시됩니다.</p>',
        ].join('\n'),
      },
    },
    {
      section: M, slug: '03-lap-chuyen', route: '/truck/trips/new',
      vi: {
        title: 'Lập chuyến (nhật ký)', navTitle: 'Lập chuyến', crumb: 'Xe tải · Quản lý · Lập chuyến',
        body: [
          intro([['URL', '<code>/truck/trips/new</code>'], ['Mục đích', 'Tạo một nhật ký chuyến hàng mới']]),
          fig(M, '03-trip-new', 'Form lập chuyến — thông tin khách hàng, tuyến và số liệu'),
          '<h2>Các trường</h2><ul><li><strong>Khách hàng</strong>, số <strong>BOL</strong> / <strong>CDF</strong> (chứng từ)</li><li><strong>Điểm đi → điểm đến</strong>, có thể thêm điểm dừng</li><li><strong>Xe</strong> (quyết định khu vực của chuyến) và <strong>tài xế</strong></li><li><strong>Số liệu</strong>: nhiên liệu (lít + đơn giá), cầu đường, doanh thu — có thể để tài xế điền khi hoàn thành</li></ul>',
          '<h2>Lưu ý</h2><p>Xe và tài xế có thể gán sau. Khi lưu, chuyến ở trạng thái <strong>Chờ hoàn thành</strong> cho đến khi ghi đủ số liệu.</p>',
        ].join('\n'),
      },
      ko: {
        title: '운행 등록(일지)', navTitle: '운행 등록', crumb: '트럭 · 관리자 · 운행 등록',
        body: [
          intro([['URL', '<code>/truck/trips/new</code>'], ['목적', '새 화물 운행 일지 생성']]),
          fig(M, '03-trip-new', '운행 등록 폼 — 고객·경로·수치'),
          '<h2>입력 항목</h2><ul><li><strong>고객</strong>, <strong>BOL</strong> / <strong>CDF</strong> 번호(증빙)</li><li><strong>출발 → 도착</strong>, 경유지 추가 가능</li><li><strong>차량</strong>(운행 지역 결정) 및 <strong>기사</strong></li><li><strong>수치</strong>: 연료(리터 + 단가), 통행료, 매출 — 완료 시 기사가 입력 가능</li></ul>',
          '<h2>참고</h2><p>차량·기사는 나중에 배정할 수 있습니다. 저장하면 수치를 모두 기록하기 전까지 <strong>완료 대기</strong> 상태입니다.</p>',
        ].join('\n'),
      },
    },
    {
      section: M, slug: '04-chi-tiet-chuyen', route: '/truck/trips',
      vi: {
        title: 'Chi tiết chuyến', navTitle: 'Chi tiết chuyến', crumb: 'Xe tải · Quản lý · Chi tiết chuyến',
        body: [
          intro([['URL', '<code>/truck/trips/{mã}</code>'], ['Bố cục', 'Chuyến đã hoàn thành hiển thị 2 cột trên desktop']]),
          fig(M, '04-trip-detail', 'Chi tiết chuyến đã hoàn thành — thông tin (trái) + chi phí & lợi nhuận (phải)'),
          '<h2>Cột thông tin</h2><p>Khách hàng, BOL/CDF, tuyến đường, xe, tài xế và <strong>lộ trình điểm dừng</strong> (nếu có).</p>',
          '<h2>Cột chi phí &amp; lợi nhuận</h2><p>Bảng liệt kê: nhiên liệu, cầu đường, chi phí phát sinh, <strong>tổng chi phí</strong>, doanh thu và <strong>lợi nhuận</strong> (xanh nếu dương, đỏ nếu âm).</p>',
          '<h2>Hành động</h2><ul><li><strong>Sửa / Xoá</strong> chuyến (Quản lý)</li><li>Chuyến chưa xong hiển thị nút <strong>Hoàn thành</strong> để nhập số liệu ngay</li></ul>',
        ].join('\n'),
      },
      ko: {
        title: '운행 상세', navTitle: '운행 상세', crumb: '트럭 · 관리자 · 운행 상세',
        body: [
          intro([['URL', '<code>/truck/trips/{번호}</code>'], ['레이아웃', '완료 운행은 데스크톱에서 2단 표시']]),
          fig(M, '04-trip-detail', '완료 운행 상세 — 정보(좌) + 비용 & 손익(우)'),
          '<h2>정보 영역</h2><p>고객, BOL/CDF, 경로, 차량, 기사, <strong>경유 동선</strong>(있는 경우).</p>',
          '<h2>비용 &amp; 손익 영역</h2><p>연료, 통행료, 기타 비용, <strong>총비용</strong>, 매출, <strong>이익</strong>(양수 초록/음수 빨강)을 표로 표시합니다.</p>',
          '<h2>동작</h2><ul><li>운행 <strong>수정 / 삭제</strong>(매니저)</li><li>미완료 운행은 <strong>완료</strong> 버튼으로 수치를 바로 입력</li></ul>',
        ].join('\n'),
      },
    },
    {
      section: M, slug: '05-doi-xe', route: '/truck/fleet',
      vi: {
        title: 'Đội xe tải', navTitle: 'Đội xe', crumb: 'Xe tải · Quản lý · Đội xe',
        body: [
          intro([['URL', '<code>/truck/fleet</code>'], ['Nội dung', 'Danh sách xe tải kèm khu vực và trạng thái']]),
          fig(M, '05-fleet', 'Danh sách đội xe tải'),
          '<h2>Thông tin mỗi xe</h2><p>Biển số, model, <strong>khu vực</strong> (HCM / Đồng Nai / Baiksan) và <strong>trạng thái</strong>: Sẵn sàng · Đang chạy · Bảo trì · Đã thanh lý.</p>',
          '<h2>Thêm / sửa xe</h2><p>Nút <strong>Thêm xe</strong> mở form (biển số, model, khu vực…). Khu vực của xe quyết định chuyến của xe đó thuộc khu vực nào trên dashboard và báo cáo.</p>',
        ].join('\n'),
      },
      ko: {
        title: '트럭 차량', navTitle: '차량', crumb: '트럭 · 관리자 · 차량',
        body: [
          intro([['URL', '<code>/truck/fleet</code>'], ['내용', '지역·상태가 포함된 트럭 목록']]),
          fig(M, '05-fleet', '트럭 차량 목록'),
          '<h2>차량 정보</h2><p>번호판, 모델, <strong>지역</strong>(HCM / 동나이 / Baiksan), <strong>상태</strong>: 사용 가능 · 운행 중 · 정비 · 폐차.</p>',
          '<h2>차량 추가 / 수정</h2><p><strong>차량 추가</strong> 버튼으로 폼을 엽니다(번호판·모델·지역 등). 차량 지역이 대시보드·보고서에서 해당 차량 운행의 지역을 결정합니다.</p>',
        ].join('\n'),
      },
    },
    {
      section: M, slug: '06-tai-xe', route: '/truck/drivers',
      vi: {
        title: 'Tài xế xe tải', navTitle: 'Tài xế', crumb: 'Xe tải · Quản lý · Tài xế',
        body: [
          intro([['URL', '<code>/truck/drivers</code>'], ['Nội dung', 'Danh sách tài xế phòng Xe tải']]),
          fig(M, '06-drivers', 'Danh sách tài xế xe tải'),
          '<h2>Thông tin mỗi tài xế</h2><p>Tên, hạng bằng lái, trạng thái. Tài xế được tạo từ người dùng đã có quyền phòng Xe tải.</p>',
          '<h2>Thêm tài xế</h2><p>Nút <strong>Thêm tài xế</strong> chọn người dùng và cấp hồ sơ tài xế. Nếu chưa có người dùng phù hợp, tạo người dùng trên AMA trước.</p>',
        ].join('\n'),
      },
      ko: {
        title: '트럭 기사', navTitle: '기사', crumb: '트럭 · 관리자 · 기사',
        body: [
          intro([['URL', '<code>/truck/drivers</code>'], ['내용', '트럭 부서 기사 목록']]),
          fig(M, '06-drivers', '트럭 기사 목록'),
          '<h2>기사 정보</h2><p>이름, 면허 등급, 상태. 기사는 트럭 부서 권한이 있는 사용자로부터 생성됩니다.</p>',
          '<h2>기사 추가</h2><p><strong>기사 추가</strong> 버튼으로 사용자를 선택해 기사 프로필을 만듭니다. 적합한 사용자가 없으면 먼저 AMA에서 사용자를 생성하세요.</p>',
        ].join('\n'),
      },
    },
    {
      section: M, slug: '07-chi-phi-loi-nhuan', route: '/truck/finance',
      vi: {
        title: 'Chi phí & Lợi nhuận', navTitle: 'Chi phí & Lợi nhuận', crumb: 'Xe tải · Quản lý · Chi phí & Lợi nhuận',
        body: [
          intro([['URL', '<code>/truck/finance</code>'], ['Kỳ', 'Chọn tháng ở đầu trang']]),
          fig(M, '07-finance', 'Chi phí & Lợi nhuận — sổ theo chuyến của tháng đã chọn'),
          '<h2>Các tab</h2><ul><li><strong>Theo chuyến</strong> — sổ liệt kê từng chuyến kèm doanh thu, chi phí, lợi nhuận</li><li><strong>Tổng quan P&amp;L</strong> — xem <a href="08-tong-quan-pnl.html">Tổng quan P&amp;L</a></li><li><strong>Hoá đơn &amp; Chi phí tháng</strong> — hoá đơn nhiên liệu, chi phí cố định</li></ul>',
          '<h2>Chi phí cố định</h2><p>Lương tài xế, khấu hao, bảo hiểm… nhập theo tháng và được cộng vào tổng chi phí khi tính lợi nhuận.</p>',
          '<h2>Đóng sổ tháng</h2><p>Khi số liệu đã chốt, <strong>đóng sổ</strong> tháng (theo khu vực) để khoá chỉnh sửa — báo cáo của tháng đó trở thành chỉ-đọc.</p>',
        ].join('\n'),
      },
      ko: {
        title: '비용 & 손익', navTitle: '비용 & 손익', crumb: '트럭 · 관리자 · 비용 & 손익',
        body: [
          intro([['URL', '<code>/truck/finance</code>'], ['기간', '상단에서 월 선택']]),
          fig(M, '07-finance', '비용 & 손익 — 선택한 달의 운행별 장부'),
          '<h2>탭</h2><ul><li><strong>운행별</strong> — 운행별 매출·비용·이익 장부</li><li><strong>손익 개요</strong> — <a href="08-tong-quan-pnl.html">손익 개요</a> 참고</li><li><strong>영수증 &amp; 월 비용</strong> — 연료 영수증, 고정비</li></ul>',
          '<h2>고정비</h2><p>기사 급여, 감가상각, 보험 등을 월 단위로 입력하며 이익 계산 시 총비용에 합산됩니다.</p>',
          '<h2>월 마감</h2><p>수치가 확정되면 해당 월(지역별)을 <strong>마감</strong>하여 수정을 잠급니다 — 그 달 보고서는 읽기 전용이 됩니다.</p>',
        ].join('\n'),
      },
    },
    {
      section: M, slug: '08-tong-quan-pnl', route: '/truck/pnl',
      vi: {
        title: 'Tổng quan P&L', navTitle: 'Tổng quan P&L', crumb: 'Xe tải · Quản lý · Tổng quan P&L',
        body: [
          intro([['URL', '<code>/truck/pnl</code>'], ['Nội dung', 'Bức tranh lãi/lỗ theo khu vực và theo tháng']]),
          fig(M, '08-pnl', 'Tổng quan P&L theo khu vực'),
          '<h2>Xem gì ở đây</h2><p>Doanh thu, tổng chi phí và lợi nhuận được tổng hợp theo <strong>khu vực</strong> và <strong>tháng</strong>, giúp so sánh hiệu quả giữa HCM / Đồng Nai / Baiksan.</p>',
          '<h2>Liên kết</h2><p>P&amp;L là một tab trong menu <a href="07-chi-phi-loi-nhuan.html">Chi phí &amp; Lợi nhuận</a>; số liệu lấy từ các chuyến đã hoàn thành và chi phí cố định của kỳ.</p>',
        ].join('\n'),
      },
      ko: {
        title: '손익 개요', navTitle: '손익 개요', crumb: '트럭 · 관리자 · 손익 개요',
        body: [
          intro([['URL', '<code>/truck/pnl</code>'], ['내용', '지역별·월별 손익 개요']]),
          fig(M, '08-pnl', '지역별 손익 개요'),
          '<h2>확인 내용</h2><p>매출·총비용·이익을 <strong>지역</strong> 및 <strong>월</strong> 기준으로 집계하여 HCM / 동나이 / Baiksan 간 효율을 비교합니다.</p>',
          '<h2>연결</h2><p>손익은 <a href="07-chi-phi-loi-nhuan.html">비용 &amp; 손익</a> 메뉴의 한 탭이며, 완료된 운행과 기간 고정비에서 수치를 가져옵니다.</p>',
        ].join('\n'),
      },
    },
    {
      section: M, slug: '09-lap-bao-cao', route: '/truck/reports/new',
      vi: {
        title: 'Lập báo cáo', navTitle: 'Lập báo cáo', crumb: 'Xe tải · Quản lý · Lập báo cáo',
        body: [
          intro([['URL', '<code>/truck/reports/new</code>'], ['Quy trình', '3 bước: Chọn tháng → Chọn khu vực → Xác nhận']]),
          fig(M, '10-report-new', 'Lập báo cáo — Bước 1: chọn tháng'),
          '<h2>Bước 1 — Chọn tháng</h2><p>Chọn tháng cần lập báo cáo. Tháng <strong>không có dữ liệu</strong> sẽ không cho đi tiếp và hiển thị cảnh báo ngay tại bước này.</p>',
          '<h2>Bước 2 — Chọn khu vực</h2><p>Chọn <strong>một khu vực</strong> (HCM / Đồng Nai / Baiksan) hoặc <strong>toàn khu vực</strong>. Khu vực không có chuyến trong tháng đó cũng bị chặn kèm cảnh báo.</p>',
          '<h2>Bước 3 — Xác nhận &amp; Lập báo cáo</h2><p>Xem lại số liệu tổng hợp rồi tạo báo cáo. Báo cáo được đặt tên kèm khu vực và có thể tải về (Excel).</p>',
        ].join('\n'),
      },
      ko: {
        title: '보고서 작성', navTitle: '보고서 작성', crumb: '트럭 · 관리자 · 보고서 작성',
        body: [
          intro([['URL', '<code>/truck/reports/new</code>'], ['절차', '3단계: 월 선택 → 지역 선택 → 확인']]),
          fig(M, '10-report-new', '보고서 작성 — 1단계: 월 선택'),
          '<h2>1단계 — 월 선택</h2><p>보고할 월을 선택합니다. <strong>데이터가 없는</strong> 달은 다음으로 진행할 수 없고 이 단계에서 즉시 경고가 표시됩니다.</p>',
          '<h2>2단계 — 지역 선택</h2><p><strong>한 지역</strong>(HCM / 동나이 / Baiksan) 또는 <strong>전체 지역</strong>을 선택합니다. 해당 월에 운행이 없는 지역도 경고와 함께 차단됩니다.</p>',
          '<h2>3단계 — 확인 &amp; 작성</h2><p>집계 수치를 검토한 뒤 보고서를 생성합니다. 보고서는 지역명과 함께 명명되며 Excel로 내려받을 수 있습니다.</p>',
        ].join('\n'),
      },
    },
    {
      section: M, slug: '10-danh-sach-bao-cao', route: '/truck/reports',
      vi: {
        title: 'Danh sách báo cáo', navTitle: 'Danh sách báo cáo', crumb: 'Xe tải · Quản lý · Danh sách báo cáo',
        body: [
          intro([['URL', '<code>/truck/reports</code>'], ['Nội dung', 'Các báo cáo đã lập']]),
          fig(M, '09-reports', 'Danh sách báo cáo đã lập'),
          '<h2>Thao tác</h2><ul><li>Xem lại và <strong>tải về</strong> báo cáo (Excel)</li><li>Báo cáo mới có nhãn <strong>Mới</strong> cho đến khi được xem</li><li>Bấm <strong>Lập báo cáo</strong> để tạo báo cáo mới (xem <a href="09-lap-bao-cao.html">Lập báo cáo</a>)</li></ul>',
        ].join('\n'),
      },
      ko: {
        title: '보고서 목록', navTitle: '보고서 목록', crumb: '트럭 · 관리자 · 보고서 목록',
        body: [
          intro([['URL', '<code>/truck/reports</code>'], ['내용', '작성된 보고서']]),
          fig(M, '09-reports', '작성된 보고서 목록'),
          '<h2>작업</h2><ul><li>보고서 확인 및 <strong>다운로드</strong>(Excel)</li><li>새 보고서는 열람 전까지 <strong>신규</strong> 배지 표시</li><li><strong>보고서 작성</strong>으로 새로 생성(<a href="09-lap-bao-cao.html">보고서 작성</a>)</li></ul>',
        ].join('\n'),
      },
    },
    // ── DRIVER ───────────────────────────────────────────────────────────────
    {
      section: D, slug: '00-tong-quan', route: '/today',
      vi: {
        title: 'Xe tải — Tổng quan Tài xế', navTitle: 'Tổng quan', crumb: 'Xe tải · Tài xế · Tổng quan',
        body: [
          intro([['Dành cho', 'Tài xế phòng <strong>Xe tải</strong>'], ['Thiết bị', 'Điện thoại (PWA) là chính, dùng được cả trên máy tính']]),
          '<p>Màn hình tài xế xe tải hướng đến <strong>hoàn thành chuyến</strong>: không có bước chấp nhận/từ chối như xe con. Bạn thấy các chuyến <strong>cần hoàn thành</strong>, ghi số liệu khi kết thúc, và xem lại chuyến đã xong.</p>',
          fig(D, '01-today', 'Màn hình Hôm nay của tài xế xe tải'),
          '<h2>Các trang</h2><ul><li><a href="01-hom-nay.html">Hôm nay</a> — danh sách chuyến cần hoàn thành + phương tiện</li><li><a href="02-hoan-thanh-chuyen.html">Hoàn thành chuyến</a> — nhập nhiên liệu, cầu đường, số km</li><li><a href="03-ghi-chuyen-moi.html">Ghi chuyến mới</a> — tự tạo một nhật ký chuyến</li></ul>',
        ].join('\n'),
      },
      ko: {
        title: '트럭 — 기사 화면 개요', navTitle: '개요', crumb: '트럭 · 기사 · 개요',
        body: [
          intro([['대상', '<strong>트럭</strong> 부서 기사'], ['기기', '휴대폰(PWA) 중심, PC에서도 사용 가능']]),
          '<p>트럭 기사 화면은 <strong>운행 완료</strong>에 초점을 둡니다 — 승용차처럼 수락/거절 단계가 없습니다. <strong>완료할</strong> 운행을 확인하고, 종료 시 수치를 기록하며, 완료된 운행을 다시 볼 수 있습니다.</p>',
          fig(D, '01-today', '트럭 기사 오늘 화면'),
          '<h2>페이지</h2><ul><li><a href="01-hom-nay.html">오늘</a> — 완료할 운행 목록 + 차량</li><li><a href="02-hoan-thanh-chuyen.html">운행 완료</a> — 연료·통행료·주행거리 입력</li><li><a href="03-ghi-chuyen-moi.html">새 운행 기록</a> — 운행 일지 직접 생성</li></ul>',
        ].join('\n'),
      },
    },
    {
      section: D, slug: '01-hom-nay', route: '/today',
      vi: {
        title: 'Hôm nay', navTitle: 'Hôm nay', crumb: 'Xe tải · Tài xế · Hôm nay',
        body: [
          intro([['URL', '<code>/today</code>'], ['Nội dung', 'Việc cần làm của tài xế trong hôm nay']]),
          fig(D, '01-today-mobile', 'Màn hình Hôm nay trên điện thoại'),
          '<h2>Cần hoàn thành</h2><p>Danh sách chuyến chờ ghi số liệu — mỗi thẻ hiện khách hàng, tuyến, ngày·giờ, biển số và trạng thái (Chờ hoàn thành / Đang chạy). Bấm để mở và <a href="02-hoan-thanh-chuyen.html">hoàn thành chuyến</a>.</p>',
          '<h2>Phương tiện &amp; Đã hoàn thành</h2><p>Bên cạnh là danh sách <strong>phương tiện của tôi</strong> và các chuyến <strong>đã hoàn thành</strong> gần đây. Trên desktop hai phần này nằm ở cột phải; trên điện thoại xếp dọc.</p>',
          '<h2>Tạo chuyến</h2><p>Nút <strong>Tạo chuyến</strong> để tự ghi một chuyến mới (xem <a href="03-ghi-chuyen-moi.html">Ghi chuyến mới</a>).</p>',
        ].join('\n'),
      },
      ko: {
        title: '오늘', navTitle: '오늘', crumb: '트럭 · 기사 · 오늘',
        body: [
          intro([['URL', '<code>/today</code>'], ['내용', '오늘 기사가 할 일']]),
          fig(D, '01-today-mobile', '휴대폰 오늘 화면'),
          '<h2>완료할 운행</h2><p>수치 기록을 기다리는 운행 목록 — 각 카드에 고객·경로·날짜/시간·번호판·상태(완료 대기 / 운행 중)가 표시됩니다. 눌러서 <a href="02-hoan-thanh-chuyen.html">운행 완료</a>를 진행합니다.</p>',
          '<h2>차량 &amp; 완료됨</h2><p>옆에는 <strong>내 차량</strong> 목록과 최근 <strong>완료된</strong> 운행이 있습니다. 데스크톱에서는 우측 열, 휴대폰에서는 세로로 배치됩니다.</p>',
          '<h2>운행 생성</h2><p><strong>운행 생성</strong> 버튼으로 새 운행을 직접 기록합니다(<a href="03-ghi-chuyen-moi.html">새 운행 기록</a>).</p>',
        ].join('\n'),
      },
    },
    {
      section: D, slug: '02-hoan-thanh-chuyen', route: '/today',
      vi: {
        title: 'Hoàn thành chuyến', navTitle: 'Hoàn thành chuyến', crumb: 'Xe tải · Tài xế · Hoàn thành chuyến',
        body: [
          intro([['Mở từ', 'Một chuyến trong danh sách "Cần hoàn thành"'], ['Mục đích', 'Ghi số liệu để chốt chuyến']]),
          fig(D, '02-trip-complete-mobile', 'Màn hình hoàn thành chuyến trên điện thoại'),
          '<h2>Các số liệu cần nhập</h2><ul><li>Giờ <strong>bắt đầu</strong> / <strong>kết thúc</strong></li><li>Số <strong>km cuối</strong> (đồng hồ)</li><li><strong>Nhiên liệu</strong> (lít) và <strong>cầu đường</strong></li><li><strong>Chi phí phát sinh</strong> — thêm từng khoản (tên + số tiền)</li></ul>',
          '<h2>Xác nhận</h2><p>Bấm <strong>Xác nhận hoàn thành</strong> để chuyển chuyến sang trạng thái <strong>Hoàn thành</strong>. Số liệu này lập tức phản ánh vào chi phí, lợi nhuận và báo cáo của Quản lý.</p>',
        ].join('\n'),
      },
      ko: {
        title: '운행 완료', navTitle: '운행 완료', crumb: '트럭 · 기사 · 운행 완료',
        body: [
          intro([['진입', '"완료할 운행" 목록의 운행'], ['목적', '수치를 기록해 운행 확정']]),
          fig(D, '02-trip-complete-mobile', '휴대폰 운행 완료 화면'),
          '<h2>입력 수치</h2><ul><li><strong>시작</strong> / <strong>종료</strong> 시각</li><li><strong>최종 주행거리</strong>(계기판)</li><li><strong>연료</strong>(리터) 및 <strong>통행료</strong></li><li><strong>기타 비용</strong> — 항목별 추가(이름 + 금액)</li></ul>',
          '<h2>확인</h2><p><strong>완료 확인</strong>을 누르면 운행이 <strong>완료</strong> 상태가 됩니다. 이 수치는 즉시 관리자의 비용·손익·보고서에 반영됩니다.</p>',
        ].join('\n'),
      },
    },
    {
      section: D, slug: '03-ghi-chuyen-moi', route: '/today/truck/new',
      vi: {
        title: 'Ghi chuyến mới', navTitle: 'Ghi chuyến mới', crumb: 'Xe tải · Tài xế · Ghi chuyến mới',
        body: [
          intro([['URL', '<code>/today/truck/new</code>'], ['Mục đích', 'Tài xế tự tạo một nhật ký chuyến']]),
          fig(D, '03-trip-new-mobile', 'Form ghi chuyến mới trên điện thoại'),
          '<h2>Nhập nhanh</h2><p>Điền khách hàng, tuyến đường và số liệu cơ bản. Có thể lưu trước rồi bổ sung nhiên liệu/cầu đường khi <a href="02-hoan-thanh-chuyen.html">hoàn thành chuyến</a>.</p>',
          '<h2>Khi nào dùng</h2><p>Dùng khi chuyến chưa được Quản lý lập sẵn — tài xế chủ động ghi để không bỏ sót chi phí và doanh thu.</p>',
        ].join('\n'),
      },
      ko: {
        title: '새 운행 기록', navTitle: '새 운행 기록', crumb: '트럭 · 기사 · 새 운행 기록',
        body: [
          intro([['URL', '<code>/today/truck/new</code>'], ['목적', '기사가 운행 일지를 직접 생성']]),
          fig(D, '03-trip-new-mobile', '휴대폰 새 운행 기록 폼'),
          '<h2>빠른 입력</h2><p>고객·경로·기본 수치를 입력합니다. 먼저 저장한 뒤 <a href="02-hoan-thanh-chuyen.html">운행 완료</a> 시 연료/통행료를 보완할 수 있습니다.</p>',
          '<h2>사용 시점</h2><p>관리자가 미리 등록하지 않은 운행에 사용합니다 — 기사가 직접 기록해 비용·매출 누락을 방지합니다.</p>',
        ].join('\n'),
      },
    },
  ];
}
