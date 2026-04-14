'use client'

// 비밀번호 재설정 페이지
// Supabase가 이메일 링크를 통해 이 페이지로 리다이렉트함
// URL에 포함된 access_token을 Supabase 클라이언트가 자동으로 처리해 세션 생성
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  // 새 비밀번호 입력값
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // 처리 상태
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 인풋 포커스 상태
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  // 버튼 호버 상태
  const [btnHover, setBtnHover] = useState(false)

  // Supabase는 URL 해시(#access_token=...&type=recovery)를 자동으로 파싱해 세션을 만들어 줌
  // PASSWORD_RECOVERY 이벤트를 감지해 세션이 준비됐는지 확인
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // onAuthStateChange로 PASSWORD_RECOVERY 이벤트 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // 이미 세션이 있는 경우 (페이지 새로고침 등)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 비밀번호 변경 처리
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (newPassword.length < 6) {
      setErrorMsg('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('비밀번호가 일치하지 않습니다.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)

    // 3초 후 홈으로 이동
    setTimeout(() => router.push('/'), 3000)
  }

  // 인풋 공통 스타일
  const inputStyle = (name: string): React.CSSProperties => ({
    width: '100%',
    height: styles.input.height,
    borderRadius: styles.input.borderRadius,
    border: focusedInput === name
      ? `1.5px solid ${colors.primary}`
      : styles.input.border,
    padding: '0 14px',
    fontSize: '15px',
    color: colors.text,
    background: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        ...styles.card,
        padding: '40px',
        boxSizing: 'border-box',
      }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Logo size="medium" />
        </div>

        {done ? (
          // 변경 완료 화면
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              background: colors.success, color: '#FFFFFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', margin: '0 auto 16px',
            }}>✓</div>
            <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
              비밀번호가 변경되었습니다
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: colors.subText }}>
              잠시 후 홈으로 이동합니다...
            </p>
          </div>
        ) : (
          // 비밀번호 입력 화면
          <>
            <p style={{
              margin: '0 0 24px',
              fontSize: '18px',
              fontWeight: 600,
              color: colors.titleText,
              textAlign: 'center',
            }}>
              새 비밀번호 설정
            </p>

            {/* 세션이 아직 준비 안 됐으면 안내 */}
            {!sessionReady && (
              <p style={{
                margin: '0 0 16px', padding: '12px', borderRadius: '8px',
                fontSize: '14px', lineHeight: 1.6,
                background: '#FEF3C7', border: `1px solid ${colors.warning}`,
                color: colors.warning, textAlign: 'center',
              }}>
                이메일 링크를 통해 접속해야 합니다.<br />
                비밀번호 재설정 이메일의 링크를 클릭해주세요.
              </p>
            )}

            {/* 에러 메시지 */}
            {errorMsg && (
              <p style={{
                margin: '0 0 16px', padding: '12px', borderRadius: '8px',
                fontSize: '14px',
                background: '#FEF2F2', border: `1px solid ${colors.danger}`,
                color: colors.danger,
              }}>
                {errorMsg}
              </p>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 새 비밀번호 */}
              <input
                type="password"
                placeholder="새 비밀번호 (6자 이상)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={() => setFocusedInput('newPassword')}
                onBlur={() => setFocusedInput(null)}
                required
                disabled={!sessionReady}
                style={inputStyle('newPassword')}
              />

              {/* 비밀번호 확인 */}
              <input
                type="password"
                placeholder="비밀번호 확인"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={() => setFocusedInput('confirmPassword')}
                onBlur={() => setFocusedInput(null)}
                required
                disabled={!sessionReady}
                style={inputStyle('confirmPassword')}
              />

              {/* 변경 버튼 */}
              <button
                type="submit"
                disabled={loading || !sessionReady}
                onMouseEnter={() => setBtnHover(true)}
                onMouseLeave={() => setBtnHover(false)}
                style={{
                  width: '100%',
                  height: styles.button.height,
                  borderRadius: styles.button.borderRadius,
                  background: loading || !sessionReady ? colors.subBackground : colors.primary,
                  color: loading || !sessionReady ? colors.subText : '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: loading || !sessionReady ? 'not-allowed' : 'pointer',
                  transform: !loading && sessionReady && btnHover ? 'translateY(-1px)' : 'translateY(0)',
                  boxShadow: !loading && sessionReady && btnHover
                    ? '0 4px 14px rgba(29,53,87,0.25)'
                    : '0 2px 6px rgba(29,53,87,0.12)',
                  transition: 'transform 0.15s, box-shadow 0.15s, background 0.15s',
                  marginTop: '8px',
                }}
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
