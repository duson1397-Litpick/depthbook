// 뎁스북 캠페인 플랜 상수
// 실제 결제 연동 시 price 값을 기준으로 토스페이먼츠 amount에 사용

export const PLANS = {
  sample_1m: {
    name: '초반부 공개 · 1개월',
    type: 'sample' as const,
    description: '초반부 10~30%만 공개 · 1개월 게시',
    price: 99000,
    priceLabel: '99,000원',
    durationDays: 30,
    maxReviewers: 10,
    features: [
      '초반부 10~30% 열람 가능',
      '익명 피드백 리포트',
      '하이라이트 문장 수집',
    ],
  },
  sample_2m: {
    name: '초반부 공개 · 2개월',
    type: 'sample' as const,
    description: '초반부 10~30%만 공개 · 2개월 게시',
    price: 149000,
    priceLabel: '149,000원',
    durationDays: 60,
    maxReviewers: 10,
    features: [
      '초반부 10~30% 열람 가능',
      '익명 피드백 리포트',
      '하이라이트 문장 수집',
      '2개월 연장 게시',
    ],
  },
  full_1m: {
    name: '완본 공개 · 1개월',
    type: 'full' as const,
    description: '완본 원고 전체 공개 · 1개월 게시',
    price: 149000,
    priceLabel: '149,000원',
    durationDays: 30,
    maxReviewers: 30,
    features: [
      '완본 원고 전체 열람',
      '익명 피드백 리포트',
      '하이라이트 문장 수집',
      '사전 수요 데이터',
      '읽고 싶다 알림 발송',
    ],
  },
  full_2m: {
    name: '완본 공개 · 2개월',
    type: 'full' as const,
    description: '완본 원고 전체 공개 · 2개월 게시',
    price: 249000,
    priceLabel: '249,000원',
    durationDays: 60,
    maxReviewers: 30,
    features: [
      '완본 원고 전체 열람',
      '익명 피드백 리포트',
      '하이라이트 문장 수집',
      '사전 수요 데이터',
      '읽고 싶다 알림 발송',
      '2개월 연장 게시',
    ],
  },
} as const

export type PlanKey = keyof typeof PLANS

// 무료 캠페인 제한 수 (사업자번호 기준)
export const FREE_CAMPAIGN_LIMIT = 3

// 무료 캠페인 게시 기간 (일) — 2개월 플랜 선택해도 무료는 1개월만 허용
export const FREE_CAMPAIGN_DURATION = 30

// 숫자를 "490,000원" 형태로 변환
export function formatPrice(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}
