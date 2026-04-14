import type { Metadata } from 'next'
import { styles, colors } from '@/lib/design'

export const metadata: Metadata = {
  title: 'DepthBook',
  description: '출간 전 원고의 독자 반응을 수집하고 익명 리포트로 정리해주는 출판 플랫폼',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <head>
        {/* 프리텐다드 웹폰트 - 가변 폰트 버전으로 모든 굵기 지원 */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: styles.fontFamily,
          background: colors.background,
          color: colors.text,
        }}
      >
        {children}
      </body>
    </html>
  )
}
