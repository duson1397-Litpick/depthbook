// 출판사 로그인 페이지 SEO 메타태그
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '출판사 로그인 — DepthBook',
  description: '출판사 계정으로 로그인하고 캠페인을 관리하세요. 리뷰어 모집부터 리포트 확인까지 한 곳에서.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
