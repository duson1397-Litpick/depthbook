import type { Metadata } from 'next'
import { styles, colors } from '@/lib/design'

export const metadata: Metadata = {
  title: 'DepthBook — 출간 전, 독자의 목소리를 먼저 들으세요',
  description:
    '출간 전 원고의 독자 반응을 수집하고 익명 리포트로 정리해주는 출판 플랫폼. 리뷰어의 솔직한 피드백으로 더 좋은 책을 만드세요.',
  keywords: '출판, 원고, 리뷰, 피드백, 베타리딩, 출판사, 리뷰어, DepthBook, 뎁스북',
  openGraph: {
    title: 'DepthBook — 출간 전, 독자의 목소리를 먼저 들으세요',
    description: '출간 전 원고의 독자 반응을 수집하고 익명 리포트로 정리해주는 출판 플랫폼.',
    url: 'https://depthbook.kr',
    siteName: 'DepthBook',
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DepthBook',
    description: '출간 전 원고의 독자 반응을 수집하고 익명 리포트로 정리해주는 출판 플랫폼.',
  },
  robots: {
    index: true,
    follow: true,
  },
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
