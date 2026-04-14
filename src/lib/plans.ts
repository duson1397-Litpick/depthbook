// 뎁스북 캠페인 플랜 상수
// 실제 결제 연동 시 이 가격 값을 기준으로 토스페이먼츠 amount에 사용
export const PLANS = {
  sample: {
    name: '샘플 캠페인',
    description: '초반부 10~30%만 공개',
    price: 190000,
    priceLabel: '190,000원 / 건',
    features: [
      '초반부 10~30% 열람 가능',
      '최대 리뷰어 10명',
      '익명 피드백 리포트',
      '하이라이트 문장 수집',
    ],
  },
  full: {
    name: '완본 캠페인',
    description: '완본 원고 전체 공개',
    price: 990000,
    priceLabel: '990,000원 / 건',
    features: [
      '완본 원고 전체 열람',
      '최대 리뷰어 30명',
      '익명 피드백 리포트',
      '하이라이트 문장 수집',
      '사전 수요 데이터',
      '읽고 싶다 알림 발송',
    ],
  },
} as const

export type PlanType = keyof typeof PLANS

// 숫자를 "990,000원" 형태로 변환
export function formatPrice(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}
