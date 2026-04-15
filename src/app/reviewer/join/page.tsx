'use client'

// 초대 링크 참여 처리 페이지
// URL: /reviewer/join?invite=xxxx
// 로그인 확인 → 캠페인 조회 → 참여 처리
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

// 화면 단계
type Phase = 'loading' | 'error' | 'publisher-account' | 'info' | 'already-joined' | 'done'

// 캠페인 정보 형태
interface CampaignInfo {
  id: string
  title: string
  author: string | null
  genre: string | null
  description: string | null
  status: string
  max_reviewers: number
  sample_ratio: number | null
}

function ReviewerJoinPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite') ?? ''
  const supabase = createClient()

  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null)
  const [accessToken, setAccessToken] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinBtnHover, setJoinBtnHover] = useState(false)
  const [switchBtnHover, setSwitchBtnHover] = useState(false)

  useEffect(() => {
    if (!inviteToken) {
      setErrorMsg('잘못된 초대 링크입니다')
      setPhase('error')
      return
    }

    const init = async () => {
      // 로그인 확인
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // 로그인 후 이 페이지로 돌아오도록 redirect 파라미터 포함
        const redirectPath = `/reviewer/join?invite=${inviteToken}`
        router.push(`/reviewer/login?redirect=${encodeURIComponent(redirectPath)}`)
        return
      }

      // 출판사 계정으로 접근한 경우 차단
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'publisher') {
        setPhase('publisher-account')
        return
      }

      // 캠페인 정보 조회 + 참여 여부 확인
      const res = await fetch(
        `/api/join-campaign?invite=${encodeURIComponent(inviteToken)}&reviewerId=${encodeURIComponent(user.id)}`
      )
      const data = await res.json()

      if (!res.ok) {
        setErrorMsg(data.error ?? '알 수 없는 오류가 발생했습니다')
        setPhase('error')
        return
      }

      setCampaign(data.campaign)

      if (data.alreadyJoined) {
        // 이미 참여 중인 경우
        setAccessToken(data.existingAccessToken ?? '')
        setPhase('already-joined')
        return
      }

      setPhase('info')
    }

    init()
  }, [inviteToken])

  // 참여 처리
  const handleJoin = async () => {
    setJoining(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/reviewer/login?redirect=${encodeURIComponent(`/reviewer/join?invite=${inviteToken}`)}`)
      return
    }

    const res = await fetch('/api/join-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteToken, reviewerId: user.id }),
    })

    const data = await res.json()

    if (!res.ok) {
      setErrorMsg(data.error ?? '참여에 실패했습니다')
      setPhase('error')
      return
    }

    setAccessToken(data.accessToken)
    setPhase('done')
    setJoining(false)
  }

  // 출판사 계정 → 로그아웃 후 리뷰어 로그인으로 이동
  const handleSwitchToReviewer = async () => {
    await supabase.auth.signOut()
    const currentUrl = `/reviewer/join?invite=${inviteToken}`
    router.push(`/reviewer/login?redirect=${encodeURIComponent(currentUrl)}`)
  }

  // 카드 공통 래퍼
  const cardWrapper = (children: React.ReactNode) => (
    <div style={{
      minHeight: '100vh', background: colors.background,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px',
    }}>
      <div style={{
        width: '100%', maxWidth: '480px',
        ...styles.card, padding: '40px', boxSizing: 'border-box',
      }}>
        {children}
      </div>
    </div>
  )

  // ── 로딩 ────────────────────────────────────────
  if (phase === 'loading') {
    return cardWrapper(
      <div style={{ textAlign: 'center', color: colors.subText, fontSize: '15px', padding: '20px 0' }}>
        불러오는 중...
      </div>
    )
  }

  // ── 출판사 계정 접근 차단 ─────────────────────────
  if (phase === 'publisher-account') {
    return cardWrapper(
      <div style={{ textAlign: 'center' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Logo size="medium" />
        </div>
        <p style={{ margin: '0 0 12px', fontSize: '40px' }}>🚫</p>
        <p style={{
          margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: colors.titleText,
        }}>
          출판사 계정으로는 리뷰어 참여가 불가합니다
        </p>
        <p style={{ margin: '0 0 28px', fontSize: '15px', color: colors.subText, lineHeight: 1.6 }}>
          리뷰어 계정으로 로그인해주세요
        </p>
        <button
          onClick={handleSwitchToReviewer}
          onMouseEnter={() => setSwitchBtnHover(true)}
          onMouseLeave={() => setSwitchBtnHover(false)}
          style={{
            width: '100%', height: styles.button.height,
            borderRadius: styles.button.borderRadius,
            background: colors.primary, color: '#FFFFFF',
            fontSize: '15px', fontWeight: 600, border: 'none',
            cursor: 'pointer',
            opacity: switchBtnHover ? 0.9 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          리뷰어 로그인
        </button>
      </div>
    )
  }

  // ── 에러 ────────────────────────────────────────
  if (phase === 'error') {
    return cardWrapper(
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: '0 0 16px', fontSize: '40px' }}>⚠️</p>
        <p style={{ margin: 0, fontSize: '16px', color: colors.text }}>{errorMsg}</p>
      </div>
    )
  }

  // ── 참여 완료 ────────────────────────────────────
  if (phase === 'done') {
    return cardWrapper(
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: colors.success, color: '#FFFFFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', margin: '0 auto',
        }}>✓</div>
        <p style={{ margin: '20px 0 0', fontSize: '20px', fontWeight: 700, color: colors.titleText }}>
          참여가 완료되었습니다
        </p>
        <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>
          원고를 읽고 소감을 남겨주세요
        </p>

        {/* 원고 읽기 버튼 */}
        <button
          onClick={() => router.push(`/v?token=${accessToken}`)}
          style={{
            width: '100%', height: styles.button.height,
            borderRadius: styles.button.borderRadius,
            background: colors.primary, color: '#FFFFFF',
            fontSize: '15px', fontWeight: 600, border: 'none',
            cursor: 'pointer', marginTop: '24px',
          }}
        >
          원고 읽기 시작 →
        </button>

        {/* 내 캠페인으로 */}
        <button
          onClick={() => router.push('/reviewer/my')}
          style={{
            background: 'none', border: 'none',
            color: colors.subText, fontSize: '14px',
            cursor: 'pointer', marginTop: '12px',
            textDecoration: 'underline',
          }}
        >
          내 캠페인으로
        </button>
      </div>
    )
  }

  // ── 이미 참여 중 ─────────────────────────────────
  if (phase === 'already-joined' && campaign) {
    return cardWrapper(
      <div>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Logo size="medium" />
        </div>

        {/* 캠페인 정보 */}
        <div style={{
          background: colors.subBackground, borderRadius: '12px',
          padding: '20px', marginBottom: '24px',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
            {campaign.title}
          </p>
          {campaign.author && (
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: colors.subText }}>{campaign.author}</p>
          )}
        </div>

        <p style={{ margin: '0 0 20px', fontSize: '16px', color: colors.text, textAlign: 'center' }}>
          이미 참여 중인 캠페인입니다
        </p>

        <button
          onClick={() => router.push(`/v?token=${accessToken}`)}
          style={{
            width: '100%', height: styles.button.height,
            borderRadius: styles.button.borderRadius,
            background: colors.primary, color: '#FFFFFF',
            fontSize: '15px', fontWeight: 600, border: 'none', cursor: 'pointer',
          }}
        >
          원고 읽기 →
        </button>
      </div>
    )
  }

  // ── 캠페인 정보 + 참여 버튼 ──────────────────────
  if (phase === 'info' && campaign) {
    const typeText = campaign.sample_ratio
      ? `샘플 (${Math.round(campaign.sample_ratio * 100)}%)`
      : '완본'

    return cardWrapper(
      <div>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Logo size="medium" />
        </div>

        {/* 페이지 제목 */}
        <p style={{
          margin: '0 0 24px', fontSize: '22px', fontWeight: 700,
          color: colors.titleText, textAlign: 'center',
        }}>
          캠페인 참여
        </p>

        {/* 캠페인 정보 박스 */}
        <div style={{
          background: colors.subBackground, borderRadius: '12px',
          padding: '20px', marginBottom: '24px',
        }}>
          <p style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
            {campaign.title}
          </p>
          {campaign.author && (
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: colors.subText }}>
              저자: {campaign.author}
            </p>
          )}
          {campaign.genre && (
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: colors.subText }}>
              장르: {campaign.genre}
            </p>
          )}
          {campaign.description && (
            <p style={{
              margin: '10px 0 0', fontSize: '14px', color: colors.text,
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {campaign.description}
            </p>
          )}
          <p style={{ margin: '10px 0 0', fontSize: '14px', color: colors.subText }}>
            유형: {typeText}
          </p>
        </div>

        {/* 참여하기 버튼 */}
        <button
          onClick={handleJoin}
          disabled={joining}
          onMouseEnter={() => setJoinBtnHover(true)}
          onMouseLeave={() => setJoinBtnHover(false)}
          style={{
            width: '100%', height: styles.button.height,
            borderRadius: styles.button.borderRadius,
            background: colors.primary, color: '#FFFFFF',
            fontSize: '16px', fontWeight: 600, border: 'none',
            cursor: joining ? 'not-allowed' : 'pointer',
            opacity: joining ? 0.6 : joinBtnHover ? 0.9 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {joining ? '참여 중...' : '참여하기'}
        </button>
      </div>
    )
  }

  return null
}

// useSearchParams()는 Suspense 경계 안에서만 사용 가능 (Next.js 14 요구사항)
export default function ReviewerJoinPage() {
  return (
    <Suspense>
      <ReviewerJoinPageInner />
    </Suspense>
  )
}
