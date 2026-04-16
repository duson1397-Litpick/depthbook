// 이용약관 페이지 — 서버 컴포넌트
// use client 불필요 (Link + 정적 콘텐츠만 사용)
import type { Metadata } from 'next'
import Link from 'next/link'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'
import { ArrowLeftIcon } from '@/components/Icons'

export const metadata: Metadata = {
  title: '이용약관 — DepthBook',
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

export default function TermsPage() {
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
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>
            <ArrowLeftIcon size={18} />
            홈
          </Link>
          <Logo size="small" />
        </div>

        {/* 본문 카드 */}
        <div style={{ ...styles.card, padding: '40px' }}>

          {/* 제목 + 시행일 */}
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.titleText }}>
            이용약관
          </h1>
          <p style={{ margin: '8px 0 32px', fontSize: '13px', color: colors.subText }}>
            시행일: 2025년 4월 13일
          </p>

          <Section title="제1조 (목적)">
            <p style={{ margin: 0 }}>
              이 약관은 뎁스북(DepthBook, 이하 "회사")이 제공하는 출판 원고 피드백 서비스(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리, 의무 및 기타 필요한 사항을 정합니다.
            </p>
          </Section>

          <Section title="제2조 (용어의 정의)">
            <p style={{ margin: '0 0 4px' }}>1. "서비스"란 회사가 제공하는 출간 전 원고의 독자 반응 수집, 리포트 생성, 리뷰 피드 운영 등 관련 서비스를 말합니다.</p>
            <p style={{ margin: '0 0 4px' }}>2. "출판사"란 원고를 업로드하고 캠페인을 생성하는 이용자를 말합니다.</p>
            <p style={{ margin: '0 0 4px' }}>3. "리뷰어"란 원고를 열람하고 피드백을 제공하는 이용자를 말합니다.</p>
            <p style={{ margin: 0 }}>4. "독자"란 리뷰 피드를 열람하고 관심을 등록하는 일반 이용자를 말합니다.</p>
          </Section>

          <Section title="제3조 (약관의 효력 및 변경)">
            <p style={{ margin: '0 0 4px' }}>1. 이 약관은 서비스 내에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</p>
            <p style={{ margin: 0 }}>2. 회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 7일 전에 공지합니다.</p>
          </Section>

          <Section title="제4조 (회원가입 및 계정)">
            <p style={{ margin: '0 0 4px' }}>1. 이용자는 이메일과 비밀번호로 회원가입할 수 있습니다.</p>
            <p style={{ margin: '0 0 4px' }}>2. 타인의 정보를 도용하여 가입한 경우 서비스 이용이 제한됩니다.</p>
            <p style={{ margin: 0 }}>3. 계정 정보의 관리 책임은 이용자에게 있습니다.</p>
          </Section>

          <Section title="제5조 (서비스의 제공)">
            <p style={{ margin: '0 0 4px' }}>1. 회사는 출판사에게 원고 업로드, 캠페인 관리, 독자 반응 리포트 서비스를 제공합니다.</p>
            <p style={{ margin: '0 0 4px' }}>2. 리뷰어에게 원고 열람, 하이라이트, 설문 및 리뷰 작성 기능을 제공합니다.</p>
            <p style={{ margin: 0 }}>3. 독자에게 리뷰 피드 열람, 관심 등록 기능을 제공합니다.</p>
          </Section>

          <Section title="제6조 (원고의 보호)">
            <p style={{ margin: '0 0 4px' }}>1. 서비스를 통해 제공되는 원고의 저작권은 해당 저작권자에게 있습니다.</p>
            <p style={{ margin: '0 0 4px' }}>2. 리뷰어는 원고를 복제, 배포, 전송, 출판할 수 없습니다.</p>
            <p style={{ margin: 0 }}>3. 원고 내용의 무단 유출 시 법적 책임을 질 수 있습니다.</p>
          </Section>

          <Section title="제7조 (리뷰 및 피드백)">
            <p style={{ margin: '0 0 4px' }}>1. 리뷰어가 작성한 익명 설문은 해당 캠페인 출판사에게만 제공됩니다.</p>
            <p style={{ margin: '0 0 4px' }}>2. 공개 리뷰는 뎁스북 피드에 게시되며, 작성자의 프로필과 함께 공개됩니다.</p>
            <p style={{ margin: 0 }}>3. 부적절한 리뷰는 회사의 판단에 따라 삭제될 수 있습니다.</p>
          </Section>

          <Section title="제8조 (결제 및 환불)">
            <p style={{ margin: '0 0 4px' }}>1. 유료 서비스의 결제는 회사가 정한 방법에 따릅니다.</p>
            <p style={{ margin: '0 0 4px' }}>2. 캠페인 생성 후 리뷰어 모집이 시작되기 전에는 전액 환불이 가능합니다.</p>
            <p style={{ margin: 0 }}>3. 리뷰어 모집 시작 이후에는 환불이 제한될 수 있습니다.</p>
          </Section>

          <Section title="제9조 (서비스의 중단)">
            <p style={{ margin: 0 }}>
              회사는 시스템 점검, 장비 교체 등의 사유로 서비스 제공을 일시적으로 중단할 수 있으며, 이 경우 사전에 공지합니다.
            </p>
          </Section>

          <Section title="제10조 (이용 제한)">
            <p style={{ margin: '0 0 6px' }}>다음 행위를 하는 이용자에 대해 서비스 이용을 제한할 수 있습니다.</p>
            <p style={{ margin: '0 0 4px' }}>1. 타인의 정보를 도용하는 행위</p>
            <p style={{ margin: '0 0 4px' }}>2. 원고를 무단으로 복제, 배포하는 행위</p>
            <p style={{ margin: '0 0 4px' }}>3. 서비스의 정상적 운영을 방해하는 행위</p>
            <p style={{ margin: 0 }}>4. 다른 이용자에게 피해를 주는 행위</p>
          </Section>

          <Section title="제11조 (면책)">
            <p style={{ margin: '0 0 4px' }}>1. 회사는 천재지변, 불가항력으로 인한 서비스 제공 불가에 대해 책임을 지지 않습니다.</p>
            <p style={{ margin: 0 }}>2. 이용자의 귀책 사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</p>
          </Section>

          {/* 마지막 섹션은 marginBottom 없음 */}
          <div>
            <h2 style={{
              margin: '0 0 10px',
              fontSize: '17px', fontWeight: 600, color: colors.titleText,
            }}>
              제12조 (분쟁 해결)
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: colors.text, lineHeight: 1.8 }}>
              서비스 이용과 관련한 분쟁은 대한민국 법을 적용하며, 관할 법원은 서울중앙지방법원으로 합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
