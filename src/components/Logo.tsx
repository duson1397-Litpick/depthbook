'use client'

// 뎁스북 로고 텍스트 컴포넌트
// 화면 너비에 따라 글자 크기를 자동으로 줄여줌
import { useState, useEffect } from 'react'
import { logoStyle } from '@/lib/design'

// 크기별 기준 글자 크기 (px)
const SIZE_MAP = {
  large: { desktop: 48, mobile: 36 },
  medium: { desktop: 32, mobile: 26 },
  small: { desktop: 24, mobile: 20 },
} as const

type LogoSize = keyof typeof SIZE_MAP

interface LogoProps {
  size?: LogoSize
}

export default function Logo({ size = 'medium' }: LogoProps) {
  // 모바일 여부 상태 (768px 미만이면 모바일로 판단)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // 처음 마운트될 때 현재 너비 확인
    const check = () => setIsMobile(window.innerWidth < 768)
    check()

    // 창 크기가 바뀔 때마다 다시 확인
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fontSize = isMobile ? SIZE_MAP[size].mobile : SIZE_MAP[size].desktop

  return (
    <span
      style={{
        ...logoStyle,
        fontSize: `${fontSize}px`,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      DepthBook
    </span>
  )
}
