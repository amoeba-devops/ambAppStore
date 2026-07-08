/**
 * multer/busboy 는 multipart 파일명 헤더를 latin1 로 디코드한다.
 * → UTF-8(특히 한글) 파일명이 mojibake 로 깨짐. latin1 바이트로 되돌려 UTF-8 로 재디코드한다.
 * macOS 업로드 파일명은 NFD(자모 분리)라 표시 일관성을 위해 NFC 로 정규화한다.
 * ASCII 파일명은 변환에 영향 없음(멱등).
 */
export function decodeMultipartFilename(originalname: string): string {
  if (!originalname) return originalname;
  return Buffer.from(originalname, 'latin1').toString('utf8').normalize('NFC');
}
