-- HS Code Manager — Initial DB Setup
-- Phase 0: DB 생성 + 사용자 계정 + 권한
-- Phase 1 이후 테이블 DDL은 별도 마이그레이션 파일로 관리한다.

CREATE DATABASE IF NOT EXISTS db_app_hscode
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- 사용자 계정 (스테이징/프로덕션은 환경변수 기반으로 별도 SQL 실행)
-- 로컬 개발 기본 계정:
CREATE USER IF NOT EXISTS 'hscode_app'@'%' IDENTIFIED BY 'hscode_app_password';
GRANT ALL PRIVILEGES ON db_app_hscode.* TO 'hscode_app'@'%';
FLUSH PRIVILEGES;
