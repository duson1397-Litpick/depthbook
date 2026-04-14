'use client'

// 공통 텍스트에어리어 컴포넌트
// 포커스 시 테두리 색상이 변하는 텍스트에어리어
import { useState } from 'react'
import { colors, styles } from '@/lib/design'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // 추가 스타일을 덮어쓰고 싶을 때
  extraStyle?: React.CSSProperties
}

export default function Textarea({ extraStyle, ...props }: TextareaProps) {
  const [focused, setFocused] = useState(false)

  return (
    <textarea
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
        borderRadius: styles.input.borderRadius,
        border: focused
          ? `1.5px solid ${colors.primary}`
          : styles.input.border,
        padding: '12px 14px',
        fontSize: '15px',
        color: colors.text,
        background: '#FFFFFF',
        outline: 'none',
        boxSizing: 'border-box',
        resize: 'vertical',
        lineHeight: 1.6,
        fontFamily: styles.fontFamily,
        transition: 'border-color 0.15s',
        ...extraStyle,
      }}
    />
  )
}
