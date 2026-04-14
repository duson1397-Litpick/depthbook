-- reports 테이블: 리뷰 신고 내역 저장
-- 같은 유저가 같은 리뷰를 중복 신고할 수 없도록 UNIQUE 제약 추가

CREATE TABLE IF NOT EXISTS reports (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 신고한 유저 (auth.users 참조)
  reporter_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 신고 대상 리뷰 (public_reviews 참조)
  public_review_id  uuid        NOT NULL REFERENCES public_reviews(id) ON DELETE CASCADE,

  -- 신고 사유 (spam | spoiler | inappropriate | etc)
  reason            text        NOT NULL,

  -- 기타 사유 상세 내용 (기본값 빈 문자열)
  detail            text        NOT NULL DEFAULT '',

  -- 처리 상태 (pending → reviewed → dismissed)
  status            text        NOT NULL DEFAULT 'pending',

  -- 신고 시각
  created_at        timestamptz NOT NULL DEFAULT now(),

  -- 같은 유저가 같은 리뷰를 중복 신고하지 못하도록 제약
  UNIQUE (reporter_id, public_review_id)
);

-- RLS 활성화 (API 라우트에서 service_role로 접근하므로 정책은 최소화)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- service_role은 RLS를 우회하므로 별도 정책 불필요
-- 관리자 전용 열람 정책 (필요 시 추가)
-- CREATE POLICY "admin only" ON reports FOR ALL TO service_role USING (true);

-- 인덱스: 신고 대상 리뷰 기준 조회 최적화
CREATE INDEX IF NOT EXISTS reports_public_review_id_idx ON reports (public_review_id);

-- 인덱스: 신고한 유저 기준 조회 최적화
CREATE INDEX IF NOT EXISTS reports_reporter_id_idx ON reports (reporter_id);
