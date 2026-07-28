/**
 * Người-trong-một-dòng cho các <Select> chọn tài xế / hành khách.
 *
 * Tồn tại vì hai lý do, cả hai đều là lỗi thật gặp trên staging:
 *
 * 1. Tên hiển thị KHÔNG duy nhất. Staging đang có hai user tên "김익용"
 *    (fremdung@gmail.com và fremd@naver.com). Mọi picker trước đây chỉ in tên,
 *    nên hai người đó là hai dòng giống nhau từng ký tự — không ai chọn đúng
 *    được. Email là thứ duy nhất người dùng đọc được để phân biệt.
 *
 * 2. Một nửa các call site nội suy thẳng `${d.user.usrName}` trong template
 *    string, KHÔNG có guard null. `car_users.usr_name` là nullable và staging
 *    có ít nhất một hàng null, nên những chỗ đó sẽ in ra đúng chữ "null — B2".
 *
 * Hàm này chỉ dựng phần ĐỊNH DANH (tên + email). Phần đuôi theo nghiệp vụ —
 * hạng bằng, số bằng, số điện thoại — do từng màn tự nối, vì mỗi màn cần mức
 * chi tiết khác nhau và đó là khác biệt có chủ ý.
 */
export function personIdentity(
  person: { usrName: string | null; usrEmail: string | null },
  fallback: string,
): string {
  const name = person.usrName?.trim();
  const email = person.usrEmail?.trim();
  /* Email chỉ đi kèm khi đã có tên — nếu không nó tự làm nhãn chính, không lặp. */
  if (name && email) return `${name} · ${email}`;
  return name || email || fallback;
}

/** Bản dùng cho hàng `car_drivers` đã join user. `drvId` là chốt cuối cùng để
 *  một option không bao giờ rỗng (Select rỗng thì không click được). */
export function driverIdentity(driver: {
  drvId: string;
  user: { usrName: string | null; usrEmail: string | null };
}): string {
  return personIdentity(driver.user, driver.drvId);
}
