// 리뷰어 로그인 페이지 SEO 메타태그
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '리뷰어 로그인 — DepthBook',
  description: '리뷰어로 로그인하고 출판 전 원고를 읽어보세요. 당신의 솔직한 피드백이 더 좋은 책을 만듭니다.',
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
