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
            'Chọn <strong>tháng</strong>, <strong>khu vực</strong> và <strong>xe</strong> ở thanh lọc đầu trang.',
            'Chuyển giữa 2 tab: <strong>Theo chuyến</strong> (sổ từng chuyến, đang xem) và <strong>Tổng quan P&amp;L</strong> (xem <a href="08-tong-quan-pnl.html">Tổng quan P&amp;L</a>).',
            'Đọc 7 thẻ tổng hợp đầu trang: doanh thu, nhiên liệu, cầu đường, phát sinh, lương tài xế, chi phí cố định, lợi nhuận ròng.',
            'Xem huy hiệu trạng thái cạnh bộ lọc: <strong>Đã lập BC · giờ</strong> (đã có báo cáo) hoặc <strong>Chưa lập báo cáo</strong>.',
            'Bấm một dòng chuyến để mở <a href="04-chi-tiet-chuyen.html">chi tiết</a>; bấm <strong>Xuất Excel</strong> để tải sổ ra ngoài.',
          ]),
          logic('Logic / Quy tắc', [
            '<strong>Đơn giá &amp; Lít hiển thị nghiêng</strong> = số tạm tính (tự nhập từng chuyến) khi tháng/khu vực <strong>chưa lập báo cáo</strong>.',
            'Sau khi <a href="09-lap-bao-cao.html">lập báo cáo</a>, hai cột này đổi sang số <strong>chính thức</strong> (phân bổ theo bình quân khu vực) và hết in nghiêng.',
            'Không còn bước "đóng sổ" thủ công — cứ sửa dữ liệu rồi lập lại báo cáo là số chính thức cập nhật theo. Huy hiệu chuyển màu vàng <strong>"dữ liệu đã thay đổi, cần lập lại"</strong> khi có thay đổi sau lần lập gần nhất.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '비용 & 손익', navTitle: '비용 & 손익', crumb: '트럭 · 관리자 · 비용 & 손익',
        body: [
          intro([['URL', '<code>/truck/finance</code>'], ['기간', '상단에서 월 선택']]),
          dmKo(M, '07-finance', '선택 월의 운행별 장부', '휴대폰 비용 & 손익'),
          steps('사용 단계', [
            '상단 필터에서 <strong>월</strong>·<strong>지역</strong>·<strong>차량</strong> 선택.',
            '2개 탭 이동: <strong>운행별</strong>(현재 화면)과 <strong>손익 개요</strong>(<a href="08-tong-quan-pnl.html">손익 개요</a> 참고).',
            '상단 7개 요약 카드 확인: 매출·연료·통행료·기타·기사 급여·고정비·순이익.',
            '필터 옆 상태 배지 확인: <strong>보고서 작성됨 · 시각</strong> 또는 <strong>미작성</strong>.',
            '운행 행 클릭 시 <a href="04-chi-tiet-chuyen.html">상세</a> 열림; <strong>Excel 내보내기</strong>로 장부 다운로드.',
          ]),
          logic('로직 / 규칙', [
            '<strong>기울임체 단가·리터</strong> = 임시 수치(운행별 직접 입력) — 해당 월/지역 <strong>보고서 미작성</strong> 상태.',
            '<a href="09-lap-bao-cao.html">보고서 작성</a> 후에는 두 값이 <strong>공식</strong> 수치(지역 평균 배분)로 바뀌고 기울임체가 사라집니다.',
            '수동 "마감" 단계는 더 이상 없습니다 — 데이터 수정 후 보고서를 다시 작성하면 공식 수치가 갱신됩니다. 마지막 작성 이후 변경이 있으면 배지가 <strong>"데이터 변경됨, 재작성 필요"</strong>(노란색)로 바뀝니다.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '08-tong-quan-pnl', route: '/truck/pnl',
      vi: {
        title: 'Tổng quan P&L', navTitle: 'Tổng quan P&L', crumb: 'Xe tải · Quản lý · Tổng quan P&L',
        body: [
          intro([['URL', '<code>/truck/pnl</code>'], ['Nội dung', 'Lãi/lỗ tổng hợp theo khu vực &amp; tháng + hoá đơn xăng dầu']]),
          dm(M, '08-pnl', 'Tổng quan P&L (khu vực HCM) kèm hoá đơn xăng dầu', 'Tổng quan P&L trên điện thoại'),
          steps('Các bước sử dụng', [
            'Chọn kỳ / khu vực để xem doanh thu – chi phí – lợi nhuận tổng hợp 3 tháng gần nhất.',
            'Mỗi cột tháng có huy hiệu <strong>Đã lập BC · giờ</strong> hoặc <strong>Chưa lập báo cáo</strong> ngay dưới tên tháng.',
            'So sánh hiệu quả giữa <strong>HCM / Đồng Nai / Baiksan</strong> bằng bộ lọc khu vực, hoặc lọc theo từng xe.',
            'Chọn <strong>một khu vực cụ thể</strong> để hiện khối <strong>Hoá đơn xăng dầu</strong> phía dưới: 4 chỉ số (Giá bình quân, Định mức tiêu hao, Tổng lít hoá đơn, Tổng km trong tháng) và danh sách hoá đơn.',
            'Nhập hoá đơn mới: ngày, cây xăng, số lít, đơn giá → bấm <strong>Thêm</strong>.',
            'Bấm <strong>Xuất Excel</strong> nếu cần lấy số liệu ra ngoài.',
          ]),
          logic('Logic / Quy tắc', [
            'Số liệu lấy từ các <strong>chuyến đã hoàn thành</strong> + <strong>chi phí cố định</strong> của kỳ.',
            '<strong>Giá bình quân</strong> = trung bình cộng đơn giá các hoá đơn xăng trong tháng của khu vực; <strong>Định mức tiêu hao</strong> = tổng lít hoá đơn ÷ tổng km các chuyến hoàn thành cùng khu vực.',
            'Hai chỉ số này là <strong>đầu vào</strong> để <a href="09-lap-bao-cao.html">Lập báo cáo</a> phân bổ phí xăng cho từng chuyến — nhập đủ hoá đơn <strong>trước khi</strong> lập báo cáo để số liệu chính xác.',
            'P&amp;L là một tab trong menu <a href="07-chi-phi-loi-nhuan.html">Chi phí &amp; Lợi nhuận</a>.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '손익 개요', navTitle: '손익 개요', crumb: '트럭 · 관리자 · 손익 개요',
        body: [
          intro([['URL', '<code>/truck/pnl</code>'], ['내용', '지역·월별 손익 집계 + 주유 영수증']]),
          dmKo(M, '08-pnl', '지역별 손익 개요(HCM, 주유 영수증 포함)', '휴대폰 손익 개요'),
          steps('사용 단계', [
            '기간/지역을 선택해 최근 3개월 매출·비용·이익 집계 확인.',
            '각 월 열 아래에 <strong>보고서 작성됨 · 시각</strong> 또는 <strong>미작성</strong> 배지 표시.',
            '지역 필터로 <strong>HCM / 동나이 / Baiksan</strong> 효율 비교, 또는 차량별 필터.',
            '<strong>특정 지역</strong>을 선택하면 아래에 <strong>주유 영수증</strong> 블록 표시: 4개 지표(평균 단가, 연비, 총 영수증 리터, 월 총 km)와 영수증 목록.',
            '새 영수증 입력: 날짜·주유소·리터·단가 입력 후 <strong>추가</strong>.',
            '필요 시 <strong>Excel 내보내기</strong>.',
          ]),
          logic('로직 / 규칙', [
            '기간의 <strong>완료 운행</strong> + <strong>고정비</strong>에서 산출.',
            '<strong>평균 단가</strong> = 해당 월·지역 주유 영수증 단가의 산술 평균; <strong>연비</strong> = 영수증 총 리터 ÷ 같은 지역 완료 운행 총 km.',
            '이 두 값은 <a href="09-lap-bao-cao.html">보고서 작성</a>이 운행별 연료비를 배분하는 <strong>입력값</strong>입니다 — 정확한 수치를 위해 보고서 작성 <strong>전에</strong> 영수증을 충분히 입력하세요.',
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
            '<strong>Bước 3 — Xác nhận &amp; Lập báo cáo</strong>: xem lại số liệu, kiểm tra huy hiệu phân bổ, rồi bấm tạo.',
            'Tải file Excel của báo cáo vừa tạo (hoặc từ <a href="10-danh-sach-bao-cao.html">Danh sách báo cáo</a>).',
          ]),
          dm(M, '10-report-new-step3', 'Bước 3 — phân bổ phí xăng theo bình quân khu vực', 'Bước 3 trên điện thoại'),
          logic('Bước 3 — phân bổ phí xăng', [
            'Huy hiệu <strong>Phân bổ theo bình quân</strong> (xanh) = khu vực này đã đủ hoá đơn xăng + km chuyến — cột <strong>Phí xăng</strong> khoá, tự tính theo định mức.',
            'Huy hiệu <strong>Tạm tính thủ công</strong> (vàng) = còn thiếu dữ liệu — cột Phí xăng vẫn sửa tay được; nên bổ sung hoá đơn ở <a href="08-tong-quan-pnl.html">Tổng quan P&amp;L</a> trước khi lập.',
            'Có chuyến chưa nhập km công tơ → hệ thống cảnh báo; chuyến đó tạm tính phí xăng bằng 0.',
            'Vẫn sửa được <strong>Cầu đường</strong> và <strong>Doanh thu</strong> trực tiếp trên bảng trước khi bấm tạo.',
          ]),
          logic('Logic / Quy tắc (chặn lỗi)', [
            'Tháng <strong>không có dữ liệu</strong> → không cho sang bước 2, báo lỗi ngay tại bước 1.',
            'Khu vực <strong>không có chuyến</strong> trong tháng đó → không cho sang bước 3, báo lỗi ngay tại bước 2.',
            '<strong>Lập lại nhiều lần không sao</strong> — mỗi lần bấm tạo, hệ thống tính lại từ dữ liệu mới nhất và ghi đè số chính thức; báo cáo cũ vẫn giữ trong <a href="10-danh-sach-bao-cao.html">Danh sách báo cáo</a> để đối chiếu.',
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
            '<strong>3단계 — 확인 &amp; 작성</strong>: 집계 수치와 배분 배지를 확인한 후 생성.',
            '생성된 보고서 Excel 다운로드(또는 <a href="10-danh-sach-bao-cao.html">보고서 목록</a>에서).',
          ]),
          dmKo(M, '10-report-new-step3', '3단계 — 지역 평균 기반 연료비 배분', '휴대폰 3단계'),
          logic('3단계 — 연료비 배분', [
            '<strong>평균 배분</strong> 배지(초록) = 이 지역의 주유 영수증·운행 km 데이터가 충분함 — <strong>연료비</strong> 열이 잠기고 연비 기준으로 자동 계산.',
            '<strong>수동 임시 집계</strong> 배지(노랑) = 데이터 부족 — 연료비 열을 직접 수정 가능; 작성 전 <a href="08-tong-quan-pnl.html">손익 개요</a>에서 영수증을 보충하는 것을 권장.',
            '주행거리(km) 미입력 운행이 있으면 경고 표시 — 해당 운행의 배분 연료비는 0으로 처리.',
            '표에서 <strong>통행료</strong>와 <strong>매출</strong>은 생성 전 직접 수정 가능.',
          ]),
          logic('로직 / 규칙(오류 차단)', [
            '<strong>데이터 없는 월</strong> → 2단계로 진행 불가, 1단계에서 즉시 경고.',
            '해당 월에 <strong>운행 없는 지역</strong> → 3단계로 진행 불가, 2단계에서 즉시 경고.',
            '<strong>여러 번 재작성해도 안전</strong> — 생성할 때마다 최신 데이터로 다시 계산해 공식 수치를 덮어씁니다; 이전 보고서는 <a href="10-danh-sach-bao-cao.html">보고서 목록</a>에 그대로 남아 대조 가능.',
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
    {
      section: M, slug: '11-import-excel', route: '/truck/import',
      vi: {
        title: 'Import Excel', navTitle: 'Import Excel', crumb: 'Xe tải · Quản lý · Import Excel',
        body: [
          intro([['URL', '<code>/truck/import</code>'], ['Mục đích', 'Nhập hàng loạt nhật ký chuyến từ file Excel — dùng khi đã có sẵn dữ liệu chạy xe ở nơi khác']]),
          dm(M, '11-import', 'Màn hình Import Excel', 'Import Excel trên điện thoại'),
          steps('Các bước sử dụng', [
            'Bấm <strong>Tải file mẫu</strong> để lấy đúng cấu trúc cột.',
            'Chọn <strong>Xe</strong> và <strong>Tài xế</strong> áp dụng cho toàn bộ file (một file chỉ gán cho một xe + một tài xế).',
            'Kéo-thả hoặc bấm để chọn file <code>.xlsx</code>/<code>.xls</code> đã điền.',
            'Nếu file có nhiều sheet: chọn sheet cần nhập ở hàng <strong>chọn sheet</strong> — mỗi sheet coi là một tháng.',
            'Kiểm tra <strong>ánh xạ cột</strong>: hệ thống tự đoán theo tên cột, có thể đổi lại thủ công. Cột <strong>Ngày</strong> là bắt buộc.',
            'Xem bảng xem trước: số dòng <strong>hợp lệ</strong> (xanh) và <strong>lỗi</strong> (đỏ, thường do thiếu ngày).',
            'Bấm <strong>Nhập N dòng</strong> — chỉ dòng hợp lệ được nhập.',
          ]),
          logic('Logic / Quy tắc', [
'File mẫu <strong>CR-Vietnam-Truck-v1</strong> có 17 cột (gồm cả cột <em>Xe (biển số)</em> — chỉ để tham khảo, vì xe/tài xế đã chọn riêng ở trên). Ứng dụng đọc 16 cột còn lại: ngày, giờ đi/về, khách hàng, điểm lấy/giao hàng, km đầu/cuối, lượng nhiên liệu + đơn giá, phí cầu đường, chi phí khác + ghi chú, số BOL, số CDF, doanh thu.',
            'Sau khi nhập thành công, hệ thống chuyển thẳng tới <a href="02-nhat-ky-chuyen.html">Nhật ký chuyến</a> lọc theo tháng vừa nhập để kiểm tra ngay.',
            'Nhập được cả vào tháng/khu vực <strong>đã lập báo cáo</strong> (không khoá dữ liệu) — nhớ <a href="09-lap-bao-cao.html">lập lại báo cáo</a> sau khi nhập để cập nhật số chính thức.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '엑셀 가져오기', navTitle: '엑셀 가져오기', crumb: '트럭 · 관리자 · 엑셀 가져오기',
        body: [
          intro([['URL', '<code>/truck/import</code>'], ['목적', '다른 곳에 있던 운행 데이터를 엑셀로 일괄 등록']]),
          dmKo(M, '11-import', '엑셀 가져오기 화면', '휴대폰 엑셀 가져오기'),
          steps('사용 단계', [
            '<strong>템플릿 다운로드</strong>로 올바른 열 구조 확인.',
            '파일 전체에 적용할 <strong>차량</strong>과 <strong>기사</strong> 선택(파일 하나 = 차량 1대 + 기사 1명).',
            '작성한 <code>.xlsx</code>/<code>.xls</code> 파일을 드래그하거나 선택.',
            '시트가 여러 개면 <strong>시트 선택</strong>에서 가져올 시트 선택 — 시트 하나 = 한 달.',
            '<strong>열 매핑</strong> 확인: 열 이름으로 자동 추정되며 수동 변경 가능. <strong>날짜</strong> 열은 필수.',
            '미리보기 표에서 <strong>유효</strong>(초록)·<strong>오류</strong>(빨강, 주로 날짜 누락) 행 수 확인.',
            '<strong>N행 가져오기</strong> 클릭 — 유효한 행만 등록됨.',
          ]),
          logic('로직 / 규칙', [
'<strong>CR-Vietnam-Truck-v1</strong> 템플릿은 17개 열(<em>차량(번호판)</em> 열 포함 — 차량·기사는 위에서 별도로 선택하므로 참고용). 앱이 실제로 읽는 열은 16개: 날짜, 출/도착 시각, 고객, 상차/하차지, 시작/종료 km, 연료량+단가, 통행료, 기타비용+메모, BOL, CDF, 매출.',
            '가져오기 성공 시 방금 가져온 달로 필터된 <a href="02-nhat-ky-chuyen.html">운행 일지</a>로 바로 이동해 확인 가능.',
            '이미 보고서가 <strong>작성된</strong> 달/지역이어도 가져오기는 가능(잠금 없음) — 가져온 후 <a href="09-lap-bao-cao.html">보고서를 다시 작성</a>해 공식 수치를 갱신하세요.',
          ]),
        ].join('\n'),
      },
    },
    {
      section: M, slug: '12-cau-hinh', route: '/truck/settings',
      vi: {
        title: 'Cấu hình xe tải', navTitle: 'Cấu hình xe tải', crumb: 'Xe tải · Quản lý · Cấu hình xe tải',
        body: [
          intro([['URL', '<code>/truck/settings</code>'], ['Nội dung', 'Địa chỉ bãi xe và lối vào chi phí cố định']]),
          dm(M, '12-settings', 'Màn hình Cấu hình xe tải', 'Cấu hình trên điện thoại'),
          steps('Các bước sử dụng', [
            'Nhập <strong>Địa chỉ bãi xe</strong> — địa chỉ này tự động điền vào điểm <strong>Xuất phát</strong> và <strong>Về bãi</strong> khi <a href="03-lap-chuyen.html">lập chuyến</a> mới, đỡ phải gõ lại mỗi lần.',
            'Bấm <strong>Lưu</strong> (hoặc <strong>Xoá địa chỉ</strong> nếu muốn bỏ trống).',
            'Thẻ <strong>Chi phí cố định</strong> chỉ hiển thị tóm tắt — bấm vào để mở <a href="08-tong-quan-pnl.html">Tổng quan P&amp;L</a>, nơi bạn xem chi phí cố định (lương, khấu hao, bảo hiểm) đang áp dụng cho từng xe theo tháng.',
          ]),
          logic('Logic / Quy tắc', [
            'Khấu hao xe mặc định nhập ngay trên hồ sơ xe (<a href="05-doi-xe.html">Đội xe</a> → sửa xe); lương tài xế mặc định nhập trên hồ sơ <a href="06-tai-xe.html">Tài xế</a> — hai giá trị này tự cộng vào chi phí cố định hàng tháng nếu tháng đó chưa có số liệu riêng.',
            'Địa chỉ bãi xe chỉ có tác dụng <strong>gợi ý điền sẵn</strong> — vẫn có thể sửa tay khi lập chuyến.',
          ]),
        ].join('\n'),
      },
      ko: {
        title: '트럭 설정', navTitle: '트럭 설정', crumb: '트럭 · 관리자 · 트럭 설정',
        body: [
          intro([['URL', '<code>/truck/settings</code>'], ['내용', '차고지 주소 및 고정비 입력 경로']]),
          dmKo(M, '12-settings', '트럭 설정 화면', '휴대폰 설정'),
          steps('사용 단계', [
            '<strong>차고지 주소</strong> 입력 — <a href="03-lap-chuyen.html">운행 등록</a> 시 <strong>출발지</strong>·<strong>복귀지</strong>에 자동으로 채워져 매번 입력할 필요가 없습니다.',
            '<strong>저장</strong>(또는 비우려면 <strong>주소 삭제</strong>).',
            '<strong>고정비</strong> 카드는 요약만 표시 — 클릭하면 <a href="08-tong-quan-pnl.html">손익 개요</a>로 이동해 차량별·월별 고정비(급여·감가상각·보험)를 확인할 수 있습니다.',
          ]),
          logic('로직 / 규칙', [
            '차량 기본 감가상각은 <a href="05-doi-xe.html">차량</a> 수정 화면에서, 기사 기본 급여는 <a href="06-tai-xe.html">기사</a> 프로필에서 입력 — 해당 월에 별도 고정비가 없으면 이 값이 자동 합산됩니다.',
            '차고지 주소는 <strong>자동 채움용 제안</strong>일 뿐 — 운행 등록 시 언제든 수동으로 수정 가능합니다.',
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
