'use client'

// 에러 바운더리 페이지 — 런타임 오류 발생 시 보여주는 화면
// Next.js 규칙: 에러 컴포넌트는 반드시 클라이언트 컴포넌트여야 함
import { useRouter } from 'next/navigation'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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

      {/* 오류 아이콘 */}
      <p style={{ margin: '24px 0 0', fontSize: '48px', lineHeight: 1 }}>⚠️</p>

      {/* 제목 */}
      <p
        style={{
          margin: '16px 0 0',
          fontSize: '18px',
          fontWeight: 600,
          color: colors.titleText,
        }}
      >
        문제가 발생했습니다
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
        잠시 후 다시 시도해주세요
      </p>

      {/* 버튼 두 개 */}
      <div
        style={{
          marginTop: '32px',
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* 다시 시도 */}
        <button
          onClick={reset}
          style={{
            padding: '12px 28px',
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
          다시 시도
        </button>

        {/* 홈으로 */}
        <button
          onClick={() => router.push('/')}
          style={{
            padding: '12px 28px',
            borderRadius: styles.button.borderRadius,
            background: 'none',
            color: colors.text,
            border: `1px solid ${colors.border}`,
            fontSize: '15px',
            fontWeight: 500,
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          홈으로
        </button>
      </div>
    </div>
  )
}
