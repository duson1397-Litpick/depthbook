'use client'

// 리뷰어 내 캠페인 목록 페이지
// 참여 중인 캠페인을 확인하고 원고 뷰어로 이동하는 페이지
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

// 리뷰어 참여 상태 종류
type ReviewerStatus = 'pending' | 'accepted' | 'reading' | 'completed' | 'rejected'

// 캠페인 정보 형태 (join 조회 결과)
interface CampaignRow {
  id: string
  status: ReviewerStatus
  access_token: string
  created_at: string
  campaigns: {
    id: string
    title: string
    author: string | null
    genre: string | null
    status: string
    description: string | null
  }[] | null
}

// 참여 상태별 뱃지 설정
const STATUS_BADGE: Record<ReviewerStatus, { background: string; color: string; label: string }> = {
  pending:   { background: '#FEF3C7', color: colors.warning,  label: '대기 중' },
  accepted:  { background: '#EEF2FF', color: colors.info,     label: '승인됨'  },
  reading:   { background: '#F0FDF4', color: colors.success,  label: '읽는 중' },
  completed: { background: '#F8FAFC', color: colors.subText2, label: '완료'    },
  rejected:  { background: '#FEF2F2', color: colors.danger,   label: '거절됨'  },
}

export default function ReviewerMyPage() {
  const router = useRouter()
  const supabase = createClient()

  // 인증 확인 중 여부
  const [authChecking, setAuthChecking] = useState(true)

  // 표시할 이름 (이름 또는 이메일)
  const [displayName, setDisplayName] = useState('')

  // 참여 캠페인 목록
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])

  // 로그아웃 버튼 호버 상태
  const [logoutHover, setLogoutHover] = useState(false)

  // 캠페인 탐색 링크 호버 상태
  const [exploreHover, setExploreHover] = useState(false)

  // 카드 내 "원고 읽기" 버튼 호버 상태 (campaign.id 기준)
  const [hoverReadBtn, setHoverReadBtn] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/reviewer/login')
        return
      }

      setAuthChecking(false)

      // 프로필에서 이름 조회 (없으면 이메일 사용)
      const { data: profile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', user.id)
        .single()

      setDisplayName(profile?.name || profile?.email || user.email || '')

      // 참여 캠페인 목록 조회
      const { data } = await supabase
        .from('campaign_reviewers')
        .select(`
          id,
          status,
          access_token,
          created_at,
          campaigns (
            id,
            title,
            author,
            genre,
            status,
            description
          )
        `)
        .eq('reviewer_id', user.id)
        .order('created_at', { ascending: false })

      setCampaigns((data ?? []) as CampaignRow[])
    }

    init()
  }, [])

  // 로그아웃 처리
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/reviewer/login')
  }

  // 인증 확인 중 로딩 화면
  if (authChecking) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: colors.background,
        color: colors.subText, fontSize: '15px',
      }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      <div style={{
        maxWidth: styles.maxWidth, margin: '0 auto', padding: '32px 20px 60px',
      }}>

        {/* 헤더 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '32px',
        }}>
          <Logo size="small" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* 캠페인 탐색 링크 */}
            <button
              onClick={() => router.push('/reviewer/campaigns')}
              onMouseEnter={() => setExploreHover(true)}
              onMouseLeave={() => setExploreHover(false)}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '14px', fontWeight: 500,
                color: exploreHover ? colors.primary2 : colors.primary,
                cursor: 'pointer', transition: 'color 0.15s',
              }}
            >
              캠페인 둘러보기
            </button>
            <button
              onClick={handleLogout}
              onMouseEnter={() => setLogoutHover(true)}
              onMouseLeave={() => setLogoutHover(false)}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: logoutHover ? colors.text : colors.subText,
                fontSize: '14px', cursor: 'pointer',
                transition: 'color 0.15s',
              }}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 환영 문구 */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.titleText }}>
            안녕하세요, {displayName}님
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>
            참여 중인 캠페인 목록입니다
          </p>
        </div>

        {/* 캠페인 목록 */}
        {campaigns.length === 0 ? (
          // 참여 캠페인 없을 때 안내 카드
          <div style={{
            ...styles.card, padding: '60px 20px', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: '16px', color: colors.subText }}>
              아직 참여한 캠페인이 없습니다
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: colors.subText2 }}>
              출판사에서 초대 링크를 받으면 참여할 수 있습니다
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {campaigns.map((row) => {
              const camp = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns
              if (!camp) return null

              const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.pending
              const metaText = [camp.author, camp.genre].filter(Boolean).join(' · ')
              const canRead = row.status === 'accepted' || row.status === 'reading'

              return (
                <div
                  key={row.id}
                  style={{ ...styles.card, padding: '24px' }}
                >
                  {/* 제목 + 상태 뱃지 */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
                      {camp.title}
                    </span>
                    <span style={{
                      background: badge.background, color: badge.color,
                      padding: '4px 12px', borderRadius: '20px',
                      fontSize: '13px', fontWeight: 500,
                      whiteSpace: 'nowrap', marginLeft: '12px',
                    }}>
                      {badge.label}
                    </span>
                  </div>

                  {/* 저자 · 장르 */}
                  {metaText && (
                    <p style={{ margin: '12px 0 0', fontSize: '14px', color: colors.subText }}>
                      {metaText}
                    </p>
                  )}

                  {/* 하단 액션 영역 */}
                  <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {canRead && (
                      <button
                        onClick={() => router.push(`/v?token=${row.access_token}`)}
                        onMouseEnter={() => setHoverReadBtn(row.id)}
                        onMouseLeave={() => setHoverReadBtn(null)}
                        style={{
                          background: colors.primary, color: '#FFFFFF',
                          border: 'none', padding: '8px 20px',
                          borderRadius: '8px', fontSize: '14px',
                          fontWeight: 600, cursor: 'pointer',
                          opacity: hoverReadBtn === row.id ? 0.9 : 1,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        원고 읽기 →
                      </button>
                    )}

                    {row.status === 'completed' && (
                      <span style={{ fontSize: '14px', color: colors.success, fontWeight: 500 }}>
                        ✓ 설문 제출 완료
                      </span>
                    )}

                    {row.status === 'pending' && (
                      <span style={{ fontSize: '14px', color: colors.subText }}>
                        출판사의 승인을 기다리고 있습니다
                      </span>
                    )}

                    {row.status === 'rejected' && (
                      <span style={{ fontSize: '14px', color: colors.danger }}>
                        참여가 거절되었습니다
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
