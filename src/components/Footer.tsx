'use client'

// 공통 푸터 컴포넌트
// 랜딩 페이지와 피드 페이지에서 사용
// 사업자 정보 + 약관 링크 + 저작권 표기
import { useState } from 'react'
import Link from 'next/link'
import { logoStyle } from '@/lib/design'

export default function Footer() {
  // 약관 링크 호버 상태
  const [hovered, setHovered] = useState<'terms' | 'privacy' | null>(null)

  return (
    <footer
      style={{
        background: '#101828',
        padding: '40px 20px',
      }}
    >
      {/* 내부 콘텐츠 최대 너비 제한 */}
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* 로고 텍스트 */}
        <p
          style={{
            margin: 0,
            ...logoStyle,
            fontSize: '20px',
            color: '#FFFFFF',
          }}
        >
          DepthBook
        </p>

        {/* 구분선 */}
        <div
          style={{
            height: '1px',
            background: 'rgba(255,255,255,0.1)',
            margin: '20px 0',
          }}
        />

        {/* 사업자 정보 */}
        <div
          style={{
            fontSize: '13px',
            color: 'rgba(255,255,255,0.45)',
            lineHeight: 1.8,
          }}
        >
          <p style={{ margin: 0 }}>
            상호: 뎁스북(DepthBook)&nbsp;&nbsp;|&nbsp;&nbsp;대표자: 이준형
          </p>
          <p style={{ margin: 0 }}>
            사업자등록번호: 860-04-03315
          </p>
          <p style={{ margin: 0 }}>
            주소: 서울특별시 용산구 한강대로52길 25-9
          </p>
          <p style={{ margin: 0 }}>
            전화: 070-8098-8397&nbsp;&nbsp;|&nbsp;&nbsp;이메일: depthbook@naver.com
          </p>
        </div>

        {/* 약관 링크 */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
          <Link
            href="/terms"
            style={{
              fontSize: '13px',
              color: hovered === 'terms' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={() => setHovered('terms')}
            onMouseLeave={() => setHovered(null)}
          >
            이용약관
          </Link>
          <Link
            href="/privacy"
            style={{
              fontSize: '13px',
              color: hovered === 'privacy' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.45)',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={() => setHovered('privacy')}
            onMouseLeave={() => setHovered(null)}
          >
            개인정보처리방침
          </Link>
        </div>

        {/* 저작권 표기 */}
        <p
          style={{
            margin: '12px 0 0',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          © 2025 DepthBook. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
