'use client'

// 리뷰어 로그인 / 회원가입 페이지
// 하나의 카드 안에서 탭으로 전환
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'
import { ArrowLeftIcon, CheckIcon } from '@/components/Icons'

type Tab = 'login' | 'signup'
type Mode = 'tabs' | 'reset'
type MessageType = 'error' | 'success'

interface Message {
  type: MessageType
  text: string
}

function ReviewerLoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  // 로그인 후 이동할 경로 (?redirect=... 파라미터)
  const redirectTo = searchParams.get('redirect') ?? '/reviewer/my'

  const [tab, setTab] = useState<Tab>('login')
  const [mode, setMode] = useState<Mode>('tabs')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  // 로그인 폼 상태
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // 회원가입 폼 상태
  const [name, setName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('')

  // 약관 동의 상태
  const [agreeTerms, setAgreeTerms] = useState(false)

  // 비밀번호 재설정 상태
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // 버튼 호버 상태
  const [btnHover, setBtnHover] = useState(false)
  const [forgotHover, setForgotHover] = useState(false)

  // 인풋 포커스 상태
  const [focusedInput, setFocusedInput] = useState<string | null>(null)

  // 이미 로그인 상태면 redirect 경로 또는 기본 경로로 이동
  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push(redirectTo)
      }
    }
    checkSession()
  }, [])

  // 탭 전환 시 메시지 초기화
  const handleTabChange = (next: Tab) => {
    setTab(next)
    setMessage(null)
  }

  // 비밀번호 재설정 링크 발송
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetSending(true)

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setResetSent(true)
    }
    setResetSending(false)
  }

  // 로그인 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      setMessage({ type: 'error', text: '이메일 또는 비밀번호가 올바르지 않습니다.' })
      setLoading(false)
      return
    }

    router.push(redirectTo)
  }

  // 회원가입 처리
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)

    if (signupPassword.length < 6) {
      setMessage({ type: 'error', text: '비밀번호는 6자 이상이어야 합니다.' })
      return
    }

    if (signupPassword !== signupPasswordConfirm) {
      setMessage({ type: 'error', text: '비밀번호가 일치하지 않습니다.' })
      return
    }

    // 약관 동의 확인
    if (!agreeTerms) {
      setMessage({ type: 'error', text: '이용약관 및 개인정보처리방침에 동의해주세요.' })
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: {
          role: 'reviewer',
          name,
        },
      },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
      setLoading(false)
      return
    }

    setMessage({ type: 'success', text: '회원가입이 완료되었습니다. 로그인해 주세요.' })
    setLoading(false)
    setTab('login')
  }

  // 인풋 공통 스타일 (포커스 여부에 따라 테두리 변경)
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

  // 버튼 스타일
  const buttonStyle: React.CSSProperties = {
    width: '100%',
    height: styles.button.height,
    borderRadius: styles.button.borderRadius,
    background: colors.primary,
    color: '#FFFFFF',
    fontSize: '15px',
    fontWeight: 600,
    border: 'none',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
    transform: !loading && btnHover ? 'translateY(-1px)' : 'translateY(0)',
    boxShadow: !loading && btnHover
      ? '0 4px 14px rgba(29,53,87,0.25)'
      : '0 2px 6px rgba(29,53,87,0.12)',
    transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.15s',
    marginTop: '20px',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: styles.card.background,
          borderRadius: styles.card.borderRadius,
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          padding: '40px',
          boxSizing: 'border-box',
        }}
      >
        {/* 상단 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Logo size="medium" />
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: colors.subText }}>
            리뷰어
          </p>
        </div>

        {/* 탭 — 비밀번호 재설정 모드일 때는 숨김 */}
        {mode === 'tabs' && (
          <div>
            <div style={{ display: 'flex' }}>
              {(['login', 'signup'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTabChange(t)}
                  style={{
                    flex: 1,
                    height: '44px',
                    background: 'none',
                    border: 'none',
                    borderBottom: tab === t
                      ? `2px solid ${colors.primary}`
                      : '2px solid transparent',
                    color: tab === t ? colors.primary : colors.subText,
                    fontWeight: tab === t ? 700 : 400,
                    fontSize: '15px',
                    cursor: 'pointer',
                    transition: 'color 0.15s',
                  }}
                >
                  {t === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>
            <div style={{ height: '1px', background: colors.border }} />
          </div>
        )}

        {/* 폼 영역 */}
        <div style={{ marginTop: '24px' }}>
          {/* 메시지 */}
          {message && (
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '16px',
                background: message.type === 'error' ? '#FEF2F2' : '#F0FDF4',
                border: `1px solid ${message.type === 'error' ? colors.danger : colors.success}`,
                color: message.type === 'error' ? colors.danger : colors.success,
              }}
            >
              {message.text}
            </div>
          )}

          {/* 비밀번호 재설정 모드 */}
          {mode === 'reset' && (
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: colors.titleText, textAlign: 'center' }}>
                비밀번호 재설정
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: colors.subText, textAlign: 'center', lineHeight: 1.6 }}>
                가입한 이메일을 입력하면 재설정 링크를 보내드립니다
              </p>
              {resetSent ? (
                <p style={{
                  padding: '16px', borderRadius: '8px', fontSize: '14px',
                  background: '#F0FDF4', border: `1px solid ${colors.success}`,
                  color: colors.success, textAlign: 'center', lineHeight: 1.6,
                }}>
                  재설정 링크가 이메일로 발송되었습니다.<br />이메일을 확인해주세요.
                </p>
              ) : (
                <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input
                    type="email" placeholder="가입한 이메일 주소" value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    onFocus={() => setFocusedInput('resetEmail')} onBlur={() => setFocusedInput(null)}
                    required style={inputStyle('resetEmail')}
                  />
                  <button type="submit" disabled={resetSending}
                    onMouseEnter={() => setBtnHover(true)} onMouseLeave={() => setBtnHover(false)}
                    style={{ ...buttonStyle, marginTop: 0 }}>
                    {resetSending ? '발송 중...' : '재설정 링크 보내기'}
                  </button>
                </form>
              )}
              <button
                onClick={() => { setMode('tabs'); setResetSent(false); setMessage(null) }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '14px', color: colors.subText, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  margin: '16px auto 0', justifyContent: 'center',
                }}
              >
                <ArrowLeftIcon size={14} />
                로그인으로 돌아가기
              </button>
            </div>
          )}

          {/* 로그인 폼 */}
          {mode === 'tabs' && tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="email" placeholder="이메일 주소" value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                onFocus={() => setFocusedInput('loginEmail')} onBlur={() => setFocusedInput(null)}
                required style={inputStyle('loginEmail')} />
              <input type="password" placeholder="비밀번호" value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onFocus={() => setFocusedInput('loginPassword')} onBlur={() => setFocusedInput(null)}
                required style={inputStyle('loginPassword')} />
              {/* 비밀번호를 잊으셨나요? */}
              <div style={{ textAlign: 'right', marginTop: '-4px' }}>
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setMessage(null) }}
                  onMouseEnter={() => setForgotHover(true)}
                  onMouseLeave={() => setForgotHover(false)}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: '13px',
                    color: forgotHover ? colors.primary : colors.subText,
                    cursor: 'pointer', transition: 'color 0.15s',
                  }}
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              <button type="submit" disabled={loading}
                onMouseEnter={() => setBtnHover(true)} onMouseLeave={() => setBtnHover(false)}
                style={buttonStyle}>
                {loading ? '처리 중...' : '로그인'}
              </button>
            </form>
          )}

          {/* 회원가입 폼 */}
          {mode === 'tabs' && tab === 'signup' && (
            <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="이름 또는 닉네임" value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedInput('name')} onBlur={() => setFocusedInput(null)}
                required style={inputStyle('name')} />
              <input type="email" placeholder="이메일 주소" value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                onFocus={() => setFocusedInput('signupEmail')} onBlur={() => setFocusedInput(null)}
                required style={inputStyle('signupEmail')} />
              <input type="password" placeholder="비밀번호 (6자 이상)" value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                onFocus={() => setFocusedInput('signupPassword')} onBlur={() => setFocusedInput(null)}
                required style={inputStyle('signupPassword')} />
              <input type="password" placeholder="비밀번호 확인" value={signupPasswordConfirm}
                onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                onFocus={() => setFocusedInput('signupPasswordConfirm')} onBlur={() => setFocusedInput(null)}
                required style={inputStyle('signupPasswordConfirm')} />

              {/* 약관 동의 체크박스 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div
                  onClick={() => setAgreeTerms(!agreeTerms)}
                  style={{
                    width: '18px', height: '18px', borderRadius: '4px',
                    flexShrink: 0, marginTop: '1px',
                    border: agreeTerms ? 'none' : `1px solid ${colors.border}`,
                    background: agreeTerms ? colors.primary : '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'background 0.15s',
                  }}
                >
                  {agreeTerms && (
                    <CheckIcon size={12} color="#FFFFFF" />
                  )}
                </div>
                <span style={{ fontSize: '13px', color: colors.subText, lineHeight: 1.5 }}>
                  <Link href="/terms" target="_blank" style={{ color: colors.primary, textDecoration: 'underline' }}>이용약관</Link>
                  {' '}및{' '}
                  <Link href="/privacy" target="_blank" style={{ color: colors.primary, textDecoration: 'underline' }}>개인정보처리방침</Link>
                  에 동의합니다
                </span>
              </div>

              <button type="submit" disabled={loading}
                onMouseEnter={() => setBtnHover(true)} onMouseLeave={() => setBtnHover(false)}
                style={buttonStyle}>
                {loading ? '처리 중...' : '회원가입'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// useSearchParams()는 Suspense 경계 안에서만 사용 가능 (Next.js 14 요구사항)
export default function ReviewerLoginPage() {
  return (
    <Suspense>
      <ReviewerLoginPageInner />
    </Suspense>
  )
}
