// 피드 페이지 SEO 메타태그
// 'use client' 페이지에서는 metadata를 export할 수 없어서 layout.tsx에서 처리
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '리뷰 피드 — DepthBook',
  description:
    '리뷰어들의 솔직한 원고 리뷰를 확인하세요. 출간 전 원고에 대한 독자의 생생한 반응을 미리 볼 수 있습니다.',
  openGraph: {
    title: '리뷰 피드 — DepthBook',
    description: '출간 전 원고에 대한 독자들의 솔직한 리뷰 모음.',
    siteName: 'DepthBook',
    locale: 'ko_KR',
    type: 'website',
  },
}

export default function FeedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
