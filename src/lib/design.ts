// 뎁스북 디자인 시스템 상수
// 컬러 팔레트와 공통 스타일 규격을 한 곳에서 관리

// 컬러 팔레트
export const colors = {
  primary: '#1D3557',       // 주요 브랜드 색상 (진한 네이비)
  primary2: '#091E7C',      // 보조 브랜드 색상 (더 진한 파랑)
  text: '#333E4F',          // 본문 텍스트
  titleText: '#101828',     // 제목 텍스트 (가장 진함)
  subText: '#64748B',       // 보조 텍스트
  subText2: '#94A3B8',      // 더 흐린 보조 텍스트
  background: '#F0F4F8',    // 페이지 배경
  subBackground: '#F9FAFB', // 보조 배경 (카드 안 섹션 등)
  cardSurface: '#FFFFFF',   // 카드 표면
  border: '#E2E8F0',        // 테두리
  success: '#2A9D8F',       // 성공 상태
  warning: '#F59E0B',       // 경고 상태
  danger: '#EF4444',        // 오류/삭제
  info: '#6366F1',          // 정보/강조
}

// 공통 스타일 규격
export const styles = {
  // 카드 공통 스타일
  card: {
    background: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },

  // 인풋 공통 스타일
  input: {
    height: '44px',
    borderRadius: '12px',
    border: '1px solid #E2E8F0',
  },

  // 버튼 공통 스타일
  button: {
    height: '48px',
    borderRadius: '12px',
  },

  // 프리텐다드 우선 적용 폰트 스택
  fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

  // 반응형 최대 너비
  maxWidth: '960px',
}

// 로고 텍스트 스타일
// 전체 프로젝트에서 "DepthBook" 텍스트를 일관되게 보여주기 위한 기준값
export const logoStyle = {
  fontFamily: "'Pretendard Variable', Pretendard, sans-serif",
  fontWeight: 800,
  letterSpacing: '-2.5px',
  color: colors.primary,
} as const
