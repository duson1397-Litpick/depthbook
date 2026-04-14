'use client'

// 404 페이지 — 존재하지 않는 경로로 접근했을 때 보여줌
import { useRouter } from 'next/navigation'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

export default function NotFoundPage() {
  const router = useRouter()

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
      }}
    >
      {/* 로고 */}
      <Logo size="large" />

      {/* 숫자 404 */}
      <p
        style={{
          margin: '24px 0 0',
          fontSize: '64px',
          fontWeight: 800,
          lineHeight: 1,
          color: colors.border,
        }}
      >
        404
      </p>

      {/* 제목 */}
      <p
        style={{
          margin: '16px 0 0',
          fontSize: '18px',
          fontWeight: 600,
          color: colors.titleText,
        }}
      >
        페이지를 찾을 수 없습니다
      </p>

      {/* 설명 */}
      <p
        style={{
          margin: '8px 0 0',
          fontSize: '15px',
          color: colors.subText,
          lineHeight: 1.6,
        }}
      >
        주소를 다시 확인해주세요
      </p>

      {/* 홈으로 버튼 */}
      <button
        onClick={() => router.push('/')}
        style={{
          marginTop: '32px',
          padding: '12px 32px',
          borderRadius: styles.button.borderRadius,
          background: colors.primary,
          color: '#FFFFFF',
          border: 'none',
          fontSize: '15px',
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        홈으로 돌아가기
      </button>
    </div>
  )
}
