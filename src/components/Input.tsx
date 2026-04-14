'use client'

// 공통 인풋 컴포넌트
// 포커스 시 테두리 색상이 변하는 인풋
import { useState } from 'react'
import { colors, styles } from '@/lib/design'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  // 추가 스타일을 덮어쓰고 싶을 때
  extraStyle?: React.CSSProperties
}

export default function Input({ extraStyle, ...props }: InputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <input
      {...props}
      onFocus={(e) => {
        setFocused(true)
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        props.onBlur?.(e)
      }}
      style={{
        width: '100%',
        height: styles.input.height,
        borderRadius: styles.input.borderRadius,
        border: focused
          ? `1.5px solid ${colors.primary}`
          : styles.input.border,
        padding: '0 14px',
        fontSize: '15px',
        color: colors.text,
        background: '#FFFFFF',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s',
        ...extraStyle,
      }}
    />
  )
}
