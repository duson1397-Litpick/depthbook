// 개인정보처리방침 페이지 — 서버 컴포넌트
// use client 불필요 (Link + 정적 콘텐츠만 사용)
import type { Metadata } from 'next'
import Link from 'next/link'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

export const metadata: Metadata = {
  title: '개인정보처리방침 — DepthBook',
  robots: { index: false, follow: false },
}

// 섹션 하나를 그리는 내부 함수
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h2 style={{
        margin: '0 0 10px',
        fontSize: '17px', fontWeight: 600, color: colors.titleText,
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: '14px', color: colors.text, lineHeight: 1.8,
      }}>
        {children}
      </div>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <div style={{ background: colors.background, minHeight: '100vh', paddingBottom: '80px' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 20px 0' }}>

        {/* 상단 내비 — 뒤로가기 + 로고 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '32px',
        }}>
          <Link href="/" style={{
            fontSize: '15px', fontWeight: 600,
            color: colors.text, textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>
            ‹ 홈
          </Link>
          <Logo size="small" />
        </div>

        {/* 본문 카드 */}
        <div style={{ ...styles.card, padding: '40px' }}>

          {/* 제목 + 시행일 */}
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.titleText }}>
            개인정보처리방침
          </h1>
          <p style={{ margin: '8px 0 32px', fontSize: '13px', color: colors.subText }}>
            시행일: 2025년 4월 13일
          </p>

          <Section title="1. 개인정보의 수집 항목 및 방법">
            <p style={{ margin: '0 0 4px' }}>회사는 서비스 제공을 위해 다음 개인정보를 수집합니다.</p>
            <p style={{ margin: '0 0 4px' }}>· 필수 항목: 이메일 주소, 비밀번호</p>
            <p style={{ margin: '0 0 4px' }}>· 선택 항목: 이름(닉네임), 출생연도, 성별, 지역</p>
            <p style={{ margin: '0 0 4px' }}>· 출판사 추가: 출판사명, 사업자등록번호, 연락처, 웹사이트</p>
            <p style={{ margin: 0 }}>수집 방법: 회원가입, 서비스 이용 과정에서 직접 입력</p>
          </Section>

          <Section title="2. 개인정보의 수집 및 이용 목적">
            <p style={{ margin: '0 0 4px' }}>· 회원 관리: 회원 식별, 가입 의사 확인, 본인 인증</p>
            <p style={{ margin: '0 0 4px' }}>· 서비스 제공: 캠페인 운영, 원고 열람 관리, 리포트 제공, 알림 발송</p>
            <p style={{ margin: 0 }}>· 서비스 개선: 이용 통계 분석, 서비스 품질 향상</p>
          </Section>

          <Section title="3. 개인정보의 보유 및 이용 기간">
            <p style={{ margin: '0 0 4px' }}>· 회원 탈퇴 시까지 보유하며, 탈퇴 후 지체 없이 파기합니다.</p>
            <p style={{ margin: '0 0 4px' }}>· 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.</p>
            <p style={{ margin: '0 0 4px' }}>  — 계약 또는 청약 철회 등에 관한 기록: 5년</p>
            <p style={{ margin: '0 0 4px' }}>  — 대금 결제 및 재화 등의 공급에 관한 기록: 5년</p>
            <p style={{ margin: 0 }}>  — 소비자의 불만 또는 분쟁 처리에 관한 기록: 3년</p>
          </Section>

          <Section title="4. 개인정보의 제3자 제공">
            <p style={{ margin: '0 0 4px' }}>회사는 이용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다.</p>
            <p style={{ margin: '0 0 4px' }}>단, 다음의 경우에는 예외로 합니다.</p>
            <p style={{ margin: '0 0 4px' }}>· 이용자가 사전에 동의한 경우</p>
            <p style={{ margin: 0 }}>· 법률에 특별한 규정이 있는 경우</p>
          </Section>

          <Section title="5. 개인정보의 처리 위탁">
            <p style={{ margin: '0 0 4px' }}>회사는 서비스 운영을 위해 다음과 같이 개인정보 처리를 위탁합니다.</p>
            <p style={{ margin: '0 0 4px' }}>· Supabase (데이터 저장 및 인증)</p>
            <p style={{ margin: '0 0 4px' }}>· Vercel (웹 서비스 호스팅)</p>
            <p style={{ margin: 0 }}>· Resend (이메일 발송) — 사용 시</p>
          </Section>

          <Section title="6. 이용자의 권리와 행사 방법">
            <p style={{ margin: '0 0 4px' }}>이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있습니다.</p>
            <p style={{ margin: '0 0 4px' }}>· 프로필 편집 기능을 통해 직접 수정</p>
            <p style={{ margin: '0 0 4px' }}>· 회원 탈퇴를 통해 삭제 요청</p>
            <p style={{ margin: 0 }}>· 이메일(depthbook@naver.com)을 통한 요청</p>
          </Section>

          <Section title="7. 개인정보의 파기">
            <p style={{ margin: '0 0 4px' }}>회원 탈퇴 시 개인정보를 지체 없이 파기합니다.</p>
            <p style={{ margin: 0 }}>전자적 파일 형태의 정보는 복구할 수 없는 방법으로 삭제합니다.</p>
          </Section>

          <Section title="8. 쿠키의 사용">
            <p style={{ margin: '0 0 4px' }}>서비스는 로그인 세션 유지를 위해 쿠키를 사용합니다.</p>
            <p style={{ margin: 0 }}>이용자는 브라우저 설정을 통해 쿠키를 거부할 수 있으나, 서비스 이용에 제한이 있을 수 있습니다.</p>
          </Section>

          <Section title="9. 개인정보 보호책임자">
            <p style={{ margin: '0 0 4px' }}>성명: 이준형</p>
            <p style={{ margin: '0 0 4px' }}>이메일: depthbook@naver.com</p>
            <p style={{ margin: 0 }}>전화: 070-8098-8397</p>
          </Section>

          {/* 마지막 섹션 */}
          <div>
            <h2 style={{
              margin: '0 0 10px',
              fontSize: '17px', fontWeight: 600, color: colors.titleText,
            }}>
              10. 개인정보처리방침의 변경
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: colors.text, lineHeight: 1.8 }}>
              이 방침은 시행일부터 적용되며, 변경 사항은 서비스 내에 공지합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
