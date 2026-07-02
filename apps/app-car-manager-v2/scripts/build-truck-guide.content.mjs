/**
 * Content for the TRUCK user guide (vi + ko). Consumed by build-truck-guide.mjs.
 * Each page: intro → desktop + mobile screenshots → step-by-step (<ol>) → logic.
 * Kept factual to the shipped UI (see the referenced screenshots). {LANG} in a
 * figure src is swapped per language at build time.
 */
export function CONTENT({ fig, intro }) {
  const M = 'truck-manager';
  const D = 'truck-driver';
  // desktop + mobile figure pair
  const dm = (sec, base, capD, capM) =>
    fig(sec, base, `${capD} (desktop)`) + '\n' + fig(sec, `${base}-mobile`, `${capM} (điện thoại)`);
  const dmKo = (sec, base, capD, capM) =>
    fig(sec, base, `${capD} (데스크톱)`) + '\n' + fig(sec, `${base}-mobile`, `${capM} (모바일)`);
  const steps = (title, items) => `<h2>${title}</h2><ol>${items.map((s) => `<li>${s}</li>`).join('')}</ol>`;
  const logic = (title, items) => `<h2>${title}</h2><ul>${items.map((s) => `<li>${s}</li>`).join('')}</ul>`;

  return [
    // ─────────────────────────── MANAGER ────────────────────────────────────
    {
      section: M, slug: '00-tong-quan', route: '/truck/dashboard',
      vi: {
        title: 'Xe tải — Tổng quan phân hệ Quản lý', navTitle: 'Tổng quan', crumb: 'Xe tải · Quản lý · Tổng quan',
        body: [
          intro([
            ['Dành cho', '<strong>Quản trị viên</strong> và <strong>Quản lý</strong> có quyền phòng <strong>Xe tải</strong>'],
            ['Thiết bị', 'Máy tính (chính) và điện thoại — mọi trang đều responsive'],
            ['Giao diện', 'Chủ đề màu <strong>cam</strong> (phân biệt với phòng Xe con màu xanh)'],
          ]),
          '<p>Phòng <strong>Xe tải</strong> phục vụ vận tải hàng hoá: mỗi chuyến là một <strong>nhật ký chuyến (LOG)</strong> ghi lại khách hàng, tuyến đường, nhiên liệu – cầu đường – doanh thu. Khác phòng Xe con (điều phối đưa đón, có bước tài xế chấp nhận/từ chối), phòng Xe tải tập trung vào <strong>ghi nhận &amp; kết toán chi phí</strong> theo từng chuyến và từng khu vực.</p>',
          dm(M, '01-dashboard', 'Bảng điều khiển Xe tải', 'Bảng điều khiển trên điện thoại'),
          steps('Vào phòng Xe tải', [
            '<strong>Quản lý chỉ phụ trách Xe tải</strong>: đăng nhập là vào thẳng.',
            '<strong>Quản trị viên (cả 2 phòng)</strong>: bấm nút chuyển <strong>Xe con / Xe tải</strong> ở đầu thanh bên. <em>Chỉ Quản trị viên</em> mới thấy và chuyển được nút này.',
            'Trên điện thoại: menu nằm ở thanh dưới cùng, nút <strong>Bảng điều khiển</strong> nhô lên ở giữa.',
          ]),
          logic('Bản đồ menu', [
            '<strong>Vận hành</strong> — Bảng điều khiển · Nhật ký chuyến · Đội xe · Tài xế',
            '<strong>Tài chính</strong> — Chi phí &amp; Lợi nhuận (kèm Tổng quan P&amp;L)',
            '<strong>Báo cáo</strong> — Lập báo cáo · Danh sách báo cáo',
            '<strong>3 khu vực</strong>: mỗi xe thuộc HCM / Đồng Nai / Baiksan; khu vực của chuyến = khu vực của xe chạy chuyến đó.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '트럭 — 관리자 화면 개요', navTitle: '개요', crumb: '트럭 · 관리자 · 개요',
        body: [
          intro([
            ['대상', '<strong>트럭</strong> 부서 권한이 있는 <strong>관리자</strong>·<strong>매니저</strong>'],
            ['기기', 'PC(기본) 및 휴대폰 — 모든 페이지 반응형'],
            ['테마', '<strong>주황색</strong> (승용차 부서 파란색과 구분)'],
          ]),
          '<p><strong>트럭</strong> 부서는 화물 운송용입니다. 각 운행은 고객·경로·연료·통행료·매출을 담은 <strong>운행 일지(LOG)</strong>이며, 배차·수락/거절이 있는 승용차와 달리 운행별·지역별 <strong>비용 기록·정산</strong>에 집중합니다.</p>',
          dmKo(M, '01-dashboard', '트럭 대시보드', '휴대폰 대시보드'),
          steps('트럭 부서 진입', [
            '<strong>트럭 전담 매니저</strong>: 로그인 시 바로 진입.',
            '<strong>관리자(양쪽 부서)</strong>: 사이드바 상단 <strong>승용차 / 트럭</strong> 전환 버튼 사용. <em>관리자만</em> 표시·전환 가능.',
            '휴대폰: 메뉴는 하단 탭, 가운데 <strong>대시보드</strong> 버튼이 돌출.',
          ]),
          logic('메뉴 구성', [
            '<strong>운영</strong> — 대시보드 · 운행 일지 · 차량 · 기사',
            '<strong>재무</strong> — 비용 &amp; 손익 (손익 개요 포함)',
            '<strong>보고서</strong> — 보고서 작성 · 보고서 목록',
            '<strong>3개 지역</strong>: 각 차량은 HCM / 동나이 / Baiksan 소속; 운행 지역 = 운행 차량의 지역.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '01-bang-dieu-khien', route: '/truck/dashboard',
      vi: {
        title: 'Bảng điều khiển Xe tải', navTitle: 'Bảng điều khiển', crumb: 'Xe tải · Quản lý · Bảng điều khiển',
        body: [
          intro([['URL', '<code>/truck/dashboard</code> — trang chủ khi vào phòng Xe tải'], ['Kỳ', 'Chọn ở góc phải trên (mặc định <strong>Tháng này</strong>)']]),
          dm(M, '01-dashboard', 'Bảng điều khiển: KPI + biểu đồ + cơ cấu chi phí + bảng khu vực', 'Bảng điều khiển trên điện thoại (cuộn dọc)'),
          steps('Các bước sử dụng', [
            'Chọn <strong>kỳ</strong> ở nút góc phải trên (Tháng này / tháng khác).',
            'Lọc <strong>khu vực</strong> bằng hàng nút <strong>Tất cả · HCM · Đồng Nai · Baiksan</strong> — toàn bộ số liệu đổi theo lựa chọn.',
            'Đọc 4 thẻ chỉ số: <strong>Doanh thu · Tổng chi phí · Lợi nhuận ròng · Số chuyến</strong> (kèm mức ▲/▼ so kỳ trước).',
            'Xem <strong>biểu đồ</strong> doanh thu &amp; lợi nhuận theo tháng và <strong>donut cơ cấu chi phí</strong>.',
            'Cuộn xuống bảng <strong>Theo khu vực</strong> và danh sách <strong>chuyến gần đây</strong> — bấm một chuyến để mở chi tiết.',
            'Bấm <strong>Tạo chuyến</strong> (góc phải) để lập nhật ký chuyến mới.',
          ]),
          logic('Logic tính số', [
            '<strong>Lợi nhuận ròng = Doanh thu − Tổng chi phí</strong> (nhiên liệu + cầu đường + phát sinh + chi phí cố định).',
            'Chỉ tính các chuyến <strong>đã Hoàn thành</strong> trong kỳ &amp; khu vực đang chọn.',
            '<strong>% so kỳ trước</strong> = so với tháng liền trước cùng khu vực.',
            'Chi phí nhiên liệu mỗi chuyến = số lít × đơn giá (hoặc theo định mức khi đã đóng sổ khu vực).',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '트럭 대시보드', navTitle: '대시보드', crumb: '트럭 · 관리자 · 대시보드',
        body: [
          intro([['URL', '<code>/truck/dashboard</code> — 트럭 부서 첫 화면'], ['기간', '우측 상단 선택 (기본 <strong>이번 달</strong>)']]),
          dmKo(M, '01-dashboard', '대시보드: 지표 + 차트 + 비용 구성 + 지역 표', '휴대폰 대시보드(세로 스크롤)'),
          steps('사용 단계', [
            '우측 상단에서 <strong>기간</strong> 선택(이번 달 / 다른 달).',
            '<strong>전체 · HCM · 동나이 · Baiksan</strong> 버튼으로 <strong>지역</strong> 필터 — 전체 수치가 함께 변경.',
            '4개 지표 확인: <strong>매출 · 총비용 · 순이익 · 운행 수</strong> (전기 대비 ▲/▼).',
            '<strong>월별 매출·이익 차트</strong>와 <strong>비용 구성 도넛</strong> 확인.',
            '아래로 스크롤해 <strong>지역별 표</strong>와 <strong>최근 운행</strong> 확인 — 운행 클릭 시 상세 열림.',
            '우측 <strong>운행 생성</strong> 버튼으로 새 일지 작성.',
          ]),
          logic('계산 로직', [
            '<strong>순이익 = 매출 − 총비용</strong>(연료 + 통행료 + 기타 + 고정비).',
            '선택한 기간·지역의 <strong>완료된</strong> 운행만 집계.',
            '<strong>전기 대비 %</strong> = 같은 지역 직전 달 대비.',
            '운행별 연료비 = 리터 × 단가(지역 마감 시 정해진 정액 적용).',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '02-nhat-ky-chuyen', route: '/truck/trips',
      vi: {
        title: 'Nhật ký chuyến', navTitle: 'Nhật ký chuyến', crumb: 'Xe tải · Quản lý · Nhật ký chuyến',
        body: [
          intro([['URL', '<code>/truck/trips</code>'], ['Nội dung', 'Toàn bộ nhật ký chuyến (LOG) của phòng Xe tải']]),
          dm(M, '02-trips-list', 'Danh sách chuyến (bảng)', 'Danh sách chuyến (thẻ) trên điện thoại'),
          steps('Các bước sử dụng', [
            '<strong>Lọc / tìm</strong> theo mã chuyến, khách hàng, xe, trạng thái ở thanh trên.',
            'Đọc mỗi dòng: mã · khách hàng · tuyến (đi → đến) · xe · tài xế · trạng thái · doanh thu.',
            'Bấm một dòng (điện thoại: một thẻ) để mở <a href="04-chi-tiet-chuyen.html">chi tiết chuyến</a>.',
            'Bấm <strong>Lập chuyến</strong> để tạo mới (xem <a href="03-lap-chuyen.html">Lập chuyến</a>).',
          ]),
          logic('Trạng thái chuyến', [
            '<strong>Chờ hoàn thành</strong> — đã tạo, chưa ghi đủ số liệu.',
            '<strong>Đang chạy</strong> — chuyến đang thực hiện.',
            '<strong>Hoàn thành</strong> — đã ghi nhiên liệu/cầu đường/doanh thu; mới được tính vào dashboard &amp; báo cáo.',
            'Chỉ hiển thị chuyến loại LOG (xe tải), không lẫn chuyến điều xe con.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '운행 일지', navTitle: '운행 일지', crumb: '트럭 · 관리자 · 운행 일지',
        body: [
          intro([['URL', '<code>/truck/trips</code>'], ['내용', '트럭 부서의 모든 운행 일지(LOG)']]),
          dmKo(M, '02-trips-list', '운행 목록(표)', '휴대폰 운행 목록(카드)'),
          steps('사용 단계', [
            '상단에서 운행번호·고객·차량·상태로 <strong>필터/검색</strong>.',
            '각 행 확인: 번호 · 고객 · 경로(출→도) · 차량 · 기사 · 상태 · 매출.',
            '행(모바일: 카드) 클릭 → <a href="04-chi-tiet-chuyen.html">운행 상세</a>.',
            '<strong>운행 등록</strong> 버튼으로 신규 작성(<a href="03-lap-chuyen.html">운행 등록</a>).',
          ]),
          logic('운행 상태', [
            '<strong>완료 대기</strong> — 생성됨, 수치 미입력.',
            '<strong>운행 중</strong> — 진행 중.',
            '<strong>완료</strong> — 연료/통행료/매출 입력 완료; 이후 대시보드·보고서에 반영.',
            'LOG(트럭) 운행만 표시(승용차 배차와 분리).',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '03-lap-chuyen', route: '/truck/trips/new',
      vi: {
        title: 'Lập chuyến (nhật ký)', navTitle: 'Lập chuyến', crumb: 'Xe tải · Quản lý · Lập chuyến',
        body: [
          intro([['URL', '<code>/truck/trips/new</code>'], ['Mục đích', 'Tạo một nhật ký chuyến hàng mới']]),
          dm(M, '03-trip-new', 'Form lập chuyến', 'Form lập chuyến trên điện thoại'),
          steps('Các bước sử dụng', [
            'Nhập <strong>Khách hàng</strong> và số chứng từ <strong>BOL / CDF</strong> (nếu có).',
            'Nhập <strong>điểm đi → điểm đến</strong>; bấm <strong>+ Thêm điểm dừng</strong> nếu chuyến có nhiều chặng.',
            'Chọn <strong>Xe</strong> (quyết định khu vực của chuyến) và <strong>Tài xế</strong>.',
            'Nhập <strong>số liệu</strong>: nhiên liệu (lít + đơn giá), cầu đường, doanh thu — có thể để trống cho tài xế điền khi hoàn thành.',
            'Bấm <strong>Lưu</strong>.',
          ]),
          logic('Logic / Quy tắc', [
            '<strong>Xe và Tài xế có thể gán sau</strong> — không bắt buộc khi tạo.',
            'Khi lưu, chuyến ở trạng thái <strong>Chờ hoàn thành</strong> cho đến khi ghi đủ số liệu.',
            'Nếu tháng của chuyến đã <strong>đóng sổ</strong> khu vực đó, hệ thống chặn tạo/sửa (kết toán đã chốt).',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '운행 등록(일지)', navTitle: '운행 등록', crumb: '트럭 · 관리자 · 운행 등록',
        body: [
          intro([['URL', '<code>/truck/trips/new</code>'], ['목적', '새 화물 운행 일지 생성']]),
          dmKo(M, '03-trip-new', '운행 등록 폼', '휴대폰 운행 등록 폼'),
          steps('사용 단계', [
            '<strong>고객</strong> 및 증빙 번호 <strong>BOL / CDF</strong>(있으면) 입력.',
            '<strong>출발 → 도착</strong> 입력; 다구간이면 <strong>+ 경유지 추가</strong>.',
            '<strong>차량</strong>(운행 지역 결정)·<strong>기사</strong> 선택.',
            '<strong>수치</strong> 입력: 연료(리터+단가)·통행료·매출 — 완료 시 기사가 입력하도록 비워둘 수 있음.',
            '<strong>저장</strong>.',
          ]),
          logic('로직 / 규칙', [
            '<strong>차량·기사는 나중에 배정 가능</strong>(생성 시 필수 아님).',
            '저장 시 수치 완비 전까지 <strong>완료 대기</strong> 상태.',
            '해당 월·지역이 <strong>마감</strong>되었으면 생성/수정 차단(정산 확정).',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '04-chi-tiet-chuyen', route: '/truck/trips',
      vi: {
        title: 'Chi tiết chuyến', navTitle: 'Chi tiết chuyến', crumb: 'Xe tải · Quản lý · Chi tiết chuyến',
        body: [
          intro([['URL', '<code>/truck/trips/{mã}</code>'], ['Bố cục', 'Chuyến đã hoàn thành: 2 cột trên desktop, xếp dọc trên điện thoại']]),
          dm(M, '04-trip-detail', 'Chi tiết: thông tin (trái) + chi phí & lợi nhuận (phải)', 'Chi tiết chuyến trên điện thoại'),
          steps('Các bước sử dụng', [
            'Xem cột <strong>thông tin</strong>: khách hàng, BOL/CDF, tuyến, xe, tài xế, lộ trình điểm dừng.',
            'Xem cột <strong>chi phí &amp; lợi nhuận</strong>: nhiên liệu, cầu đường, phát sinh, tổng chi phí, doanh thu, lợi nhuận.',
            'Bấm <strong>Sửa</strong> để chỉnh số liệu, hoặc <strong>Xoá</strong> (xoá mềm).',
            'Nếu chuyến <strong>chưa hoàn thành</strong>: bấm <strong>Hoàn thành</strong> để nhập số liệu ngay.',
          ]),
          logic('Logic / Quy tắc', [
            '<strong>Lợi nhuận = Doanh thu − Tổng chi phí</strong> (xanh nếu dương, đỏ nếu âm).',
            'Số liệu chuyến phản ánh ngay vào Bảng điều khiển, P&amp;L và Báo cáo của khu vực tương ứng.',
            'Chuyến thuộc tháng đã đóng sổ khu vực → chỉ xem, không sửa.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '운행 상세', navTitle: '운행 상세', crumb: '트럭 · 관리자 · 운행 상세',
        body: [
          intro([['URL', '<code>/truck/trips/{번호}</code>'], ['레이아웃', '완료 운행: 데스크톱 2단, 모바일 세로']]),
          dmKo(M, '04-trip-detail', '상세: 정보(좌) + 비용 & 손익(우)', '휴대폰 운행 상세'),
          steps('사용 단계', [
            '<strong>정보</strong> 영역: 고객·BOL/CDF·경로·차량·기사·경유 동선.',
            '<strong>비용 &amp; 손익</strong> 영역: 연료·통행료·기타·총비용·매출·이익.',
            '<strong>수정</strong>으로 수치 변경 또는 <strong>삭제</strong>(소프트 삭제).',
            '<strong>미완료</strong> 운행이면 <strong>완료</strong>로 수치 즉시 입력.',
          ]),
          logic('로직 / 규칙', [
            '<strong>이익 = 매출 − 총비용</strong>(양수 초록/음수 빨강).',
            '운행 수치는 해당 지역의 대시보드·손익·보고서에 즉시 반영.',
            '마감된 월·지역의 운행은 보기 전용.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '05-doi-xe', route: '/truck/fleet',
      vi: {
        title: 'Đội xe tải', navTitle: 'Đội xe', crumb: 'Xe tải · Quản lý · Đội xe',
        body: [
          intro([['URL', '<code>/truck/fleet</code>'], ['Nội dung', 'Danh sách xe tải kèm khu vực &amp; trạng thái']]),
          dm(M, '05-fleet', 'Danh sách đội xe', 'Đội xe trên điện thoại'),
          steps('Các bước sử dụng', [
            'Xem mỗi xe: <strong>biển số · model · khu vực · trạng thái</strong>.',
            'Bấm <strong>Thêm xe</strong> → nhập biển số, model, <strong>khu vực</strong> (HCM/Đồng Nai/Baiksan), trạng thái.',
            'Bấm một xe để <strong>sửa</strong> thông tin.',
          ]),
          logic('Logic / Quy tắc', [
            'Trạng thái: <strong>Sẵn sàng · Đang chạy · Bảo trì · Đã thanh lý</strong>.',
            '<strong>Khu vực của xe quyết định khu vực của chuyến</strong> mà xe đó chạy → ảnh hưởng dashboard, P&amp;L, báo cáo.',
            'Xoá xe là xoá mềm (giữ lịch sử chuyến).',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '트럭 차량', navTitle: '차량', crumb: '트럭 · 관리자 · 차량',
        body: [
          intro([['URL', '<code>/truck/fleet</code>'], ['내용', '지역·상태 포함 트럭 목록']]),
          dmKo(M, '05-fleet', '차량 목록', '휴대폰 차량 목록'),
          steps('사용 단계', [
            '각 차량 확인: <strong>번호판 · 모델 · 지역 · 상태</strong>.',
            '<strong>차량 추가</strong> → 번호판·모델·<strong>지역</strong>(HCM/동나이/Baiksan)·상태 입력.',
            '차량 클릭 → 정보 <strong>수정</strong>.',
          ]),
          logic('로직 / 규칙', [
            '상태: <strong>사용 가능 · 운행 중 · 정비 · 폐차</strong>.',
            '<strong>차량 지역이 그 차량 운행의 지역을 결정</strong> → 대시보드·손익·보고서에 영향.',
            '차량 삭제는 소프트 삭제(운행 이력 보존).',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '06-tai-xe', route: '/truck/drivers',
      vi: {
        title: 'Tài xế xe tải', navTitle: 'Tài xế', crumb: 'Xe tải · Quản lý · Tài xế',
        body: [
          intro([['URL', '<code>/truck/drivers</code>'], ['Nội dung', 'Danh sách tài xế phòng Xe tải']]),
          dm(M, '06-drivers', 'Danh sách tài xế', 'Tài xế trên điện thoại'),
          steps('Các bước sử dụng', [
            'Xem mỗi tài xế: tên, hạng bằng, trạng thái.',
            'Bấm <strong>Thêm tài xế</strong> → chọn người dùng đã có quyền phòng Xe tải, nhập hồ sơ.',
            'Nếu chưa có người dùng phù hợp: tạo người dùng trên AMA trước, cấp quyền Xe tải, rồi quay lại.',
          ]),
          logic('Logic / Quy tắc', [
            'Tài xế được tạo từ <strong>người dùng AMA</strong> đã được cấp quyền phòng Xe tải (car_user_fleet_access).',
            'Một tài xế chỉ thuộc <strong>một phòng</strong> (Xe con hoặc Xe tải).',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '트럭 기사', navTitle: '기사', crumb: '트럭 · 관리자 · 기사',
        body: [
          intro([['URL', '<code>/truck/drivers</code>'], ['내용', '트럭 부서 기사 목록']]),
          dmKo(M, '06-drivers', '기사 목록', '휴대폰 기사 목록'),
          steps('사용 단계', [
            '각 기사 확인: 이름·면허 등급·상태.',
            '<strong>기사 추가</strong> → 트럭 권한 있는 사용자를 선택해 프로필 입력.',
            '적합한 사용자가 없으면 AMA에서 사용자 생성 → 트럭 권한 부여 후 재시도.',
          ]),
          logic('로직 / 규칙', [
            '기사는 트럭 권한(car_user_fleet_access)이 부여된 <strong>AMA 사용자</strong>로부터 생성.',
            '한 기사는 <strong>한 부서</strong>에만 소속(승용차 또는 트럭).',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '07-chi-phi-loi-nhuan', route: '/truck/finance',
      vi: {
        title: 'Chi phí & Lợi nhuận', navTitle: 'Chi phí & Lợi nhuận', crumb: 'Xe tải · Quản lý · Chi phí & Lợi nhuận',
        body: [
          intro([['URL', '<code>/truck/finance</code>'], ['Kỳ', 'Chọn tháng ở đầu trang']]),
          dm(M, '07-finance', 'Sổ theo chuyến của tháng đã chọn', 'Chi phí & Lợi nhuận trên điện thoại'),
          steps('Các bước sử dụng', [
            'Chọn <strong>tháng</strong> ở đầu trang.',
            'Chuyển giữa 3 tab: <strong>Theo chuyến</strong> (sổ từng chuyến) · <strong>Tổng quan P&amp;L</strong> · <strong>Hoá đơn &amp; Chi phí tháng</strong>.',
            'Ở tab Hoá đơn &amp; Chi phí: nhập <strong>chi phí cố định</strong> (lương, khấu hao, bảo hiểm) và <strong>hoá đơn nhiên liệu</strong> của tháng.',
            'Khi số liệu đã chốt: bấm <strong>Đóng sổ</strong> tháng (theo khu vực).',
          ]),
          logic('Logic / Quy tắc', [
            'Chi phí cố định của tháng được <strong>cộng vào tổng chi phí</strong> khi tính lợi nhuận.',
            '<strong>Đóng sổ</strong> = khoá chỉnh sửa chuyến/chi phí của (tháng × khu vực) đó; báo cáo thành chỉ-đọc. Có thể <strong>mở lại</strong> (chỉ Quản trị viên).',
            'Đóng sổ chốt <strong>đơn giá &amp; định mức nhiên liệu</strong> để tính chi phí nhất quán.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '비용 & 손익', navTitle: '비용 & 손익', crumb: '트럭 · 관리자 · 비용 & 손익',
        body: [
          intro([['URL', '<code>/truck/finance</code>'], ['기간', '상단에서 월 선택']]),
          dmKo(M, '07-finance', '선택 월의 운행별 장부', '휴대폰 비용 & 손익'),
          steps('사용 단계', [
            '상단에서 <strong>월</strong> 선택.',
            '3개 탭 이동: <strong>운행별</strong> · <strong>손익 개요</strong> · <strong>영수증 &amp; 월 비용</strong>.',
            '영수증 &amp; 비용 탭에서 <strong>고정비</strong>(급여·감가·보험)와 <strong>연료 영수증</strong> 입력.',
            '수치 확정 시 지역별 <strong>월 마감</strong>.',
          ]),
          logic('로직 / 규칙', [
            '월 고정비는 이익 계산 시 <strong>총비용에 합산</strong>.',
            '<strong>마감</strong> = 해당 (월 × 지역) 운행/비용 수정 잠금, 보고서 읽기 전용. <strong>재개</strong> 가능(관리자만).',
            '마감 시 <strong>연료 단가·정액</strong>을 확정해 일관된 비용 계산.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '08-tong-quan-pnl', route: '/truck/pnl',
      vi: {
        title: 'Tổng quan P&L', navTitle: 'Tổng quan P&L', crumb: 'Xe tải · Quản lý · Tổng quan P&L',
        body: [
          intro([['URL', '<code>/truck/pnl</code>'], ['Nội dung', 'Lãi/lỗ tổng hợp theo khu vực &amp; tháng']]),
          dm(M, '08-pnl', 'Tổng quan P&L theo khu vực', 'Tổng quan P&L trên điện thoại'),
          steps('Các bước sử dụng', [
            'Chọn kỳ / khu vực để xem doanh thu – chi phí – lợi nhuận tổng hợp.',
            'So sánh hiệu quả giữa <strong>HCM / Đồng Nai / Baiksan</strong>.',
            'Bấm <strong>Xuất Excel</strong> nếu cần lấy số liệu ra ngoài.',
          ]),
          logic('Logic / Quy tắc', [
            'Số liệu lấy từ các <strong>chuyến đã hoàn thành</strong> + <strong>chi phí cố định</strong> của kỳ.',
            'P&amp;L là một tab trong menu <a href="07-chi-phi-loi-nhuan.html">Chi phí &amp; Lợi nhuận</a>.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '손익 개요', navTitle: '손익 개요', crumb: '트럭 · 관리자 · 손익 개요',
        body: [
          intro([['URL', '<code>/truck/pnl</code>'], ['내용', '지역·월별 손익 집계']]),
          dmKo(M, '08-pnl', '지역별 손익 개요', '휴대폰 손익 개요'),
          steps('사용 단계', [
            '기간/지역을 선택해 매출·비용·이익 집계 확인.',
            '<strong>HCM / 동나이 / Baiksan</strong> 간 효율 비교.',
            '필요 시 <strong>Excel 내보내기</strong>.',
          ]),
          logic('로직 / 규칙', [
            '기간의 <strong>완료 운행</strong> + <strong>고정비</strong>에서 산출.',
            '손익은 <a href="07-chi-phi-loi-nhuan.html">비용 &amp; 손익</a> 메뉴의 한 탭.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '09-lap-bao-cao', route: '/truck/reports/new',
      vi: {
        title: 'Lập báo cáo', navTitle: 'Lập báo cáo', crumb: 'Xe tải · Quản lý · Lập báo cáo',
        body: [
          intro([['URL', '<code>/truck/reports/new</code>'], ['Quy trình', '3 bước: Chọn tháng → Chọn khu vực → Xác nhận']]),
          dm(M, '10-report-new', 'Bước 1 — chọn tháng', 'Lập báo cáo trên điện thoại'),
          steps('Các bước sử dụng', [
            '<strong>Bước 1 — Chọn tháng</strong>: chọn tháng cần lập báo cáo.',
            '<strong>Bước 2 — Chọn khu vực</strong>: chọn một khu vực (HCM/Đồng Nai/Baiksan) hoặc <strong>toàn khu vực</strong>.',
            '<strong>Bước 3 — Xác nhận &amp; Lập báo cáo</strong>: xem lại số liệu tổng hợp rồi bấm tạo.',
            'Tải file Excel của báo cáo vừa tạo (hoặc từ <a href="10-danh-sach-bao-cao.html">Danh sách báo cáo</a>).',
          ]),
          logic('Logic / Quy tắc (chặn lỗi)', [
            'Tháng <strong>không có dữ liệu</strong> → không cho sang bước 2, báo lỗi ngay tại bước 1.',
            'Khu vực <strong>không có chuyến</strong> trong tháng đó → không cho sang bước 3, báo lỗi ngay tại bước 2.',
            'Báo cáo được đặt tên kèm <strong>khu vực</strong> và lưu vào Danh sách báo cáo.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '보고서 작성', navTitle: '보고서 작성', crumb: '트럭 · 관리자 · 보고서 작성',
        body: [
          intro([['URL', '<code>/truck/reports/new</code>'], ['절차', '3단계: 월 → 지역 → 확인']]),
          dmKo(M, '10-report-new', '1단계 — 월 선택', '휴대폰 보고서 작성'),
          steps('사용 단계', [
            '<strong>1단계 — 월 선택</strong>: 보고할 월 선택.',
            '<strong>2단계 — 지역 선택</strong>: 한 지역(HCM/동나이/Baiksan) 또는 <strong>전체 지역</strong>.',
            '<strong>3단계 — 확인 &amp; 작성</strong>: 집계 수치 검토 후 생성.',
            '생성된 보고서 Excel 다운로드(또는 <a href="10-danh-sach-bao-cao.html">보고서 목록</a>에서).',
          ]),
          logic('로직 / 규칙(오류 차단)', [
            '<strong>데이터 없는 월</strong> → 2단계로 진행 불가, 1단계에서 즉시 경고.',
            '해당 월에 <strong>운행 없는 지역</strong> → 3단계로 진행 불가, 2단계에서 즉시 경고.',
            '보고서는 <strong>지역명</strong>과 함께 명명되어 목록에 저장.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '10-danh-sach-bao-cao', route: '/truck/reports',
      vi: {
        title: 'Danh sách báo cáo', navTitle: 'Danh sách báo cáo', crumb: 'Xe tải · Quản lý · Danh sách báo cáo',
        body: [
          intro([['URL', '<code>/truck/reports</code>'], ['Nội dung', 'Các báo cáo đã lập']]),
          dm(M, '09-reports', 'Danh sách báo cáo đã lập', 'Danh sách báo cáo trên điện thoại'),
          steps('Các bước sử dụng', [
            'Xem các báo cáo đã lập (tháng · khu vực · người lập · thời điểm).',
            'Bấm <strong>Tải về</strong> để lấy file Excel.',
            'Bấm <strong>Lập báo cáo</strong> để tạo báo cáo mới (xem <a href="09-lap-bao-cao.html">Lập báo cáo</a>).',
          ]),
          logic('Logic / Quy tắc', [
            'Báo cáo mới có nhãn <strong>Mới</strong> cho đến khi bạn xem trang này.',
            'File báo cáo được lưu trên máy chủ (S3), tải lại bất cứ lúc nào.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '보고서 목록', navTitle: '보고서 목록', crumb: '트럭 · 관리자 · 보고서 목록',
        body: [
          intro([['URL', '<code>/truck/reports</code>'], ['내용', '작성된 보고서']]),
          dmKo(M, '09-reports', '작성된 보고서 목록', '휴대폰 보고서 목록'),
          steps('사용 단계', [
            '작성된 보고서 확인(월·지역·작성자·시각).',
            '<strong>다운로드</strong>로 Excel 파일 받기.',
            '<strong>보고서 작성</strong>으로 신규 생성(<a href="09-lap-bao-cao.html">보고서 작성</a>).',
          ]),
          logic('로직 / 규칙', [
            '새 보고서는 이 페이지를 열기 전까지 <strong>신규</strong> 배지 표시.',
            '보고서 파일은 서버(S3)에 저장되어 언제든 재다운로드.',
          ]),
        ].join('\n'),
      },
    },
    // ─────────────────────────── DRIVER ─────────────────────────────────────
    {
      section: D, slug: '00-tong-quan', route: '/today',
      vi: {
        title: 'Xe tải — Tổng quan Tài xế', navTitle: 'Tổng quan', crumb: 'Xe tải · Tài xế · Tổng quan',
        body: [
          intro([['Dành cho', 'Tài xế phòng <strong>Xe tải</strong>'], ['Thiết bị', 'Điện thoại (PWA) là chính, dùng được cả trên máy tính']]),
          '<p>Màn hình tài xế xe tải hướng đến <strong>hoàn thành chuyến</strong>: không có bước chấp nhận/từ chối như xe con. Bạn thấy các chuyến <strong>cần hoàn thành</strong>, ghi số liệu khi kết thúc, và xem lại chuyến đã xong.</p>',
          dm(D, '01-today', 'Màn hình Hôm nay của tài xế', 'Hôm nay trên điện thoại'),
          steps('3 trang chính', [
            '<a href="01-hom-nay.html">Hôm nay</a> — chuyến cần hoàn thành + phương tiện + đã hoàn thành.',
            '<a href="02-hoan-thanh-chuyen.html">Hoàn thành chuyến</a> — nhập nhiên liệu, cầu đường, số km.',
            '<a href="03-ghi-chuyen-moi.html">Ghi chuyến mới</a> — tự tạo một nhật ký chuyến.',
          ]),
          logic('Khác gì phòng Xe con?', [
            '<strong>Không có</strong> bước chấp nhận / từ chối chuyến.',
            'Trọng tâm là <strong>ghi số liệu để chốt chi phí</strong>, không phải điều phối đưa đón.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '트럭 — 기사 화면 개요', navTitle: '개요', crumb: '트럭 · 기사 · 개요',
        body: [
          intro([['대상', '<strong>트럭</strong> 부서 기사'], ['기기', '휴대폰(PWA) 중심, PC도 가능']]),
          '<p>트럭 기사 화면은 <strong>운행 완료</strong>에 초점 — 승용차 같은 수락/거절이 없습니다. <strong>완료할</strong> 운행을 보고, 종료 시 수치를 기록하며, 완료 운행을 다시 봅니다.</p>',
          dmKo(D, '01-today', '기사 오늘 화면', '휴대폰 오늘 화면'),
          steps('3개 페이지', [
            '<a href="01-hom-nay.html">오늘</a> — 완료할 운행 + 차량 + 완료됨.',
            '<a href="02-hoan-thanh-chuyen.html">운행 완료</a> — 연료·통행료·주행거리 입력.',
            '<a href="03-ghi-chuyen-moi.html">새 운행 기록</a> — 운행 일지 직접 생성.',
          ]),
          logic('승용차와 차이', [
            '운행 수락/거절 단계 <strong>없음</strong>.',
            '배차가 아니라 <strong>수치 기록·비용 확정</strong>에 집중.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: D, slug: '01-hom-nay', route: '/today',
      vi: {
        title: 'Hôm nay', navTitle: 'Hôm nay', crumb: 'Xe tải · Tài xế · Hôm nay',
        body: [
          intro([['URL', '<code>/today</code>'], ['Nội dung', 'Việc cần làm của tài xế hôm nay']]),
          dm(D, '01-today', 'Màn hình Hôm nay', 'Hôm nay trên điện thoại'),
          steps('Các bước sử dụng', [
            'Xem mục <strong>Cần hoàn thành</strong> — mỗi thẻ có khách hàng, tuyến, ngày·giờ, biển số, trạng thái.',
            'Bấm một chuyến để mở và <a href="02-hoan-thanh-chuyen.html">hoàn thành</a>.',
            'Xem <strong>Phương tiện của tôi</strong> và các chuyến <strong>Đã hoàn thành</strong> gần đây.',
            'Bấm <strong>Tạo chuyến</strong> để tự ghi một chuyến mới.',
          ]),
          logic('Logic / Quy tắc', [
            'Danh sách <strong>Cần hoàn thành</strong> = chuyến ở trạng thái Chờ hoàn thành / Đang chạy được gán cho bạn.',
            'Trên desktop bố cục 2 cột; trên điện thoại xếp dọc, nút Tạo chuyến rộng hết chiều ngang.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '오늘', navTitle: '오늘', crumb: '트럭 · 기사 · 오늘',
        body: [
          intro([['URL', '<code>/today</code>'], ['내용', '오늘 기사가 할 일']]),
          dmKo(D, '01-today', '오늘 화면', '휴대폰 오늘 화면'),
          steps('사용 단계', [
            '<strong>완료할 운행</strong> 확인 — 고객·경로·날짜/시간·번호판·상태.',
            '운행을 눌러 <a href="02-hoan-thanh-chuyen.html">완료</a> 진행.',
            '<strong>내 차량</strong>과 최근 <strong>완료됨</strong> 운행 확인.',
            '<strong>운행 생성</strong>으로 새 운행 직접 기록.',
          ]),
          logic('로직 / 규칙', [
            '<strong>완료할 운행</strong> = 나에게 배정된 완료 대기/운행 중 상태.',
            '데스크톱 2단, 모바일 세로 + 운행 생성 버튼 전체 너비.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: D, slug: '02-hoan-thanh-chuyen', route: '/today',
      vi: {
        title: 'Hoàn thành chuyến', navTitle: 'Hoàn thành chuyến', crumb: 'Xe tải · Tài xế · Hoàn thành chuyến',
        body: [
          intro([['Mở từ', 'Một chuyến trong "Cần hoàn thành"'], ['Mục đích', 'Ghi số liệu để chốt chuyến']]),
          dm(D, '02-trip-complete', 'Màn hình hoàn thành chuyến', 'Hoàn thành chuyến trên điện thoại'),
          steps('Các bước sử dụng', [
            'Mở chuyến từ danh sách <strong>Cần hoàn thành</strong>.',
            'Nhập giờ <strong>bắt đầu</strong> / <strong>kết thúc</strong>.',
            'Nhập số <strong>km cuối</strong> (đồng hồ), <strong>nhiên liệu</strong> (lít) và <strong>cầu đường</strong>.',
            'Thêm <strong>chi phí phát sinh</strong> nếu có (tên + số tiền, bấm + để thêm dòng).',
            'Bấm <strong>Xác nhận hoàn thành</strong>.',
          ]),
          logic('Logic / Quy tắc', [
            'Sau khi xác nhận, chuyến chuyển sang <strong>Hoàn thành</strong>.',
            'Số liệu <strong>lập tức</strong> vào chi phí, lợi nhuận và báo cáo của Quản lý.',
            'Nếu tháng/khu vực đã đóng sổ, bạn không thể sửa nữa.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '운행 완료', navTitle: '운행 완료', crumb: '트럭 · 기사 · 운행 완료',
        body: [
          intro([['진입', '"완료할 운행"의 항목'], ['목적', '수치 기록으로 운행 확정']]),
          dmKo(D, '02-trip-complete', '운행 완료 화면', '휴대폰 운행 완료'),
          steps('사용 단계', [
            '<strong>완료할 운행</strong> 목록에서 운행 열기.',
            '<strong>시작</strong>/<strong>종료</strong> 시각 입력.',
            '<strong>최종 주행거리</strong>(계기판)·<strong>연료</strong>(리터)·<strong>통행료</strong> 입력.',
            '필요 시 <strong>기타 비용</strong> 추가(이름+금액, + 버튼).',
            '<strong>완료 확인</strong>.',
          ]),
          logic('로직 / 규칙', [
            '확인 시 운행이 <strong>완료</strong> 상태로 전환.',
            '수치는 관리자 비용·손익·보고서에 <strong>즉시</strong> 반영.',
            '월·지역 마감 시 수정 불가.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: D, slug: '03-ghi-chuyen-moi', route: '/today/truck/new',
      vi: {
        title: 'Ghi chuyến mới', navTitle: 'Ghi chuyến mới', crumb: 'Xe tải · Tài xế · Ghi chuyến mới',
        body: [
          intro([['URL', '<code>/today/truck/new</code>'], ['Mục đích', 'Tài xế tự tạo một nhật ký chuyến']]),
          dm(D, '03-trip-new', 'Form ghi chuyến mới', 'Ghi chuyến mới trên điện thoại'),
          steps('Các bước sử dụng', [
            'Nhập <strong>khách hàng</strong> và <strong>tuyến đường</strong> (điểm đi → đến).',
            'Nhập số liệu cơ bản (có thể bổ sung nhiên liệu/cầu đường khi hoàn thành).',
            'Bấm <strong>Lưu</strong>.',
          ]),
          logic('Khi nào dùng', [
            'Dùng khi chuyến <strong>chưa được Quản lý lập sẵn</strong> — tài xế chủ động ghi để không sót chi phí/doanh thu.',
            'Sau khi lưu, hoàn tất số liệu ở bước <a href="02-hoan-thanh-chuyen.html">Hoàn thành chuyến</a>.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '새 운행 기록', navTitle: '새 운행 기록', crumb: '트럭 · 기사 · 새 운행 기록',
        body: [
          intro([['URL', '<code>/today/truck/new</code>'], ['목적', '기사가 운행 일지 직접 생성']]),
          dmKo(D, '03-trip-new', '새 운행 기록 폼', '휴대폰 새 운행 기록'),
          steps('사용 단계', [
            '<strong>고객</strong>·<strong>경로</strong>(출→도) 입력.',
            '기본 수치 입력(연료/통행료는 완료 시 보완 가능).',
            '<strong>저장</strong>.',
          ]),
          logic('사용 시점', [
            '관리자가 <strong>미리 등록하지 않은</strong> 운행에 사용 — 비용/매출 누락 방지.',
            '저장 후 <a href="02-hoan-thanh-chuyen.html">운행 완료</a>에서 수치 완성.',
          ]),
        ].join('\n'),
      },
    },
  ];
}
