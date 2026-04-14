'use client'

// 리뷰어 캠페인 탐색 페이지
// 모집 중인 캠페인 목록을 보고 직접 참여 신청할 수 있는 페이지
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

// 장르 필터 목록
const GENRES = ['전체', '소설', '에세이', '인문', '자기계발', '경영', '과학', '시', '기타']

// 캠페인 데이터 형태
interface Campaign {
  id: string
  title: string
  author: string | null
  genre: string | null
  description: string | null
  status: string
  max_reviewers: number
  deadline: string | null
  total_want_to_read: number | null
  created_at: string
}

// YYYY.MM.DD 형식으로 날짜 변환
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd}`
}

export default function ReviewerCampaignsPage() {
  const router = useRouter()
  const supabase = createClient()

  // 인증 확인 중 여부
  const [authChecking, setAuthChecking] = useState(true)

  // 현재 로그인한 리뷰어 id
  const [currentUserId, setCurrentUserId] = useState('')

  // 캠페인 목록
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)

  // 선택된 장르 필터 (기본값: 전체)
  const [selectedGenre, setSelectedGenre] = useState('전체')

  // 내가 이미 참여 중인 캠페인 id 집합
  const [myParticipationIds, setMyParticipationIds] = useState<Set<string>>(new Set())

  // 각 캠페인의 현재 리뷰어 수 (campaign_id → 수)
  const [reviewerCounts, setReviewerCounts] = useState<Record<string, number>>({})

  // 방금 신청 완료된 캠페인 id 집합 (즉시 반영용)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  // 신청 요청이 진행 중인 캠페인 id 집합
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set())

  // 버튼 호버 상태
  const [logoutHover, setLogoutHover] = useState(false)
  const [myLinkHover, setMyLinkHover] = useState(false)

  // ── 초기 인증 확인 + 내 참여 목록 로드 ──────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/reviewer/login?redirect=/reviewer/campaigns')
        return
      }

      setCurrentUserId(user.id)
      setAuthChecking(false)

      // 내가 이미 참여 중인 캠페인 id 목록 조회
      const { data: participations } = await supabase
        .from('campaign_reviewers')
        .select('campaign_id')
        .eq('reviewer_id', user.id)

      setMyParticipationIds(
        new Set((participations ?? []).map((p: any) => p.campaign_id as string))
      )
    }

    init()
  }, [])

  // ── 장르 필터 변경 시 캠페인 목록 다시 조회 ──────
  useEffect(() => {
    // 인증 확인 전에는 실행하지 않음
    if (authChecking) return
    loadCampaigns()
  }, [selectedGenre, authChecking])

  // ── 캠페인 목록 + 리뷰어 수 조회 ────────────────
  const loadCampaigns = async () => {
    setCampaignsLoading(true)

    let query = supabase
      .from('campaigns')
      .select('id, title, author, genre, description, status, max_reviewers, deadline, total_want_to_read, created_at')
      .eq('status', 'recruiting')
      .order('created_at', { ascending: false })

    // 전체가 아니면 장르 필터 추가
    if (selectedGenre !== '전체') {
      query = query.eq('genre', selectedGenre)
    }

    const { data } = await query
    const list = (data ?? []) as Campaign[]
    setCampaigns(list)

    // 각 캠페인의 현재 리뷰어 수를 병렬로 조회
    const counts: Record<string, number> = {}
    await Promise.all(
      list.map(async (campaign) => {
        const { count } = await supabase
          .from('campaign_reviewers')
          .select('*', { count: 'exact', head: true })
          .eq('campaign_id', campaign.id)
          .in('status', ['accepted', 'reading', 'completed'])
        counts[campaign.id] = count ?? 0
      })
    )

    setReviewerCounts(counts)
    setCampaignsLoading(false)
  }

  // ── 참여 신청 처리 ────────────────────────────
  const handleApply = async (campaignId: string) => {
    if (!currentUserId) return

    // 신청 중 상태로 전환
    setApplyingIds((prev) => {
      const next = new Set(prev)
      next.add(campaignId)
      return next
    })

    const res = await fetch('/api/join-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId, reviewerId: currentUserId }),
    })

    // 신청 중 상태 해제
    setApplyingIds((prev) => {
      const next = new Set(prev)
      next.delete(campaignId)
      return next
    })

    if (res.ok) {
      // 신청 완료 상태로 즉시 전환
      setAppliedIds((prev) => {
        const next = new Set(prev)
        next.add(campaignId)
        return next
      })
    } else {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? '신청에 실패했습니다.')
    }
  }

  // ── 로그아웃 처리 ─────────────────────────────
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
      {/* 장르 필터 스크롤바 숨기기 (웹킷 브라우저용) */}
      <style>{`.genre-scroll::-webkit-scrollbar { display: none; }`}</style>

      <div style={{ maxWidth: styles.maxWidth, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* 헤더 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '32px',
        }}>
          <Logo size="small" />
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* 내 캠페인 링크 */}
            <button
              onClick={() => router.push('/reviewer/my')}
              onMouseEnter={() => setMyLinkHover(true)}
              onMouseLeave={() => setMyLinkHover(false)}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '14px', fontWeight: 500,
                color: myLinkHover ? colors.primary2 : colors.primary,
                cursor: 'pointer', transition: 'color 0.15s',
              }}
            >
              내 캠페인
            </button>
            {/* 로그아웃 */}
            <button
              onClick={handleLogout}
              onMouseEnter={() => setLogoutHover(true)}
              onMouseLeave={() => setLogoutHover(false)}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '14px',
                color: logoutHover ? colors.text : colors.subText,
                cursor: 'pointer', transition: 'color 0.15s',
              }}
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 페이지 제목 */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.titleText }}>
            캠페인 둘러보기
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>
            모집 중인 캠페인에 참여해보세요
          </p>
        </div>

        {/* 장르 필터 가로 스크롤 */}
        <div
          className="genre-scroll"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            marginBottom: '20px',
            paddingBottom: '4px',
          }}
        >
          {GENRES.map((genre) => {
            const isSelected = selectedGenre === genre
            return (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  border: isSelected ? 'none' : `1px solid ${colors.border}`,
                  background: isSelected ? colors.primary : colors.subBackground,
                  color: isSelected ? '#FFFFFF' : colors.text,
                  transition: 'all 0.15s',
                }}
              >
                {genre}
              </button>
            )
          })}
        </div>

        {/* 캠페인 목록 */}
        {campaignsLoading ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: colors.subText, fontSize: '15px',
          }}>
            불러오는 중...
          </div>
        ) : campaigns.length === 0 ? (
          // 캠페인 없을 때 안내 카드
          <div style={{ ...styles.card, padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '16px', color: colors.subText }}>
              현재 모집 중인 캠페인이 없습니다
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {campaigns.map((campaign) => {
              const currentCount = reviewerCounts[campaign.id] ?? 0
              const isFull = currentCount >= campaign.max_reviewers
              const isParticipating = myParticipationIds.has(campaign.id)
              const isApplied = appliedIds.has(campaign.id)
              const isApplying = applyingIds.has(campaign.id)

              return (
                <div key={campaign.id} style={{ ...styles.card, padding: '24px' }}>

                  {/* 상단: 제목/저자 + 장르 태그 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}>
                    <div style={{ flex: 1, marginRight: '12px' }}>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
                        {campaign.title}
                      </p>
                      {campaign.author && (
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: colors.subText }}>
                          {campaign.author}
                        </p>
                      )}
                    </div>
                    {campaign.genre && (
                      <span style={{
                        flexShrink: 0,
                        background: colors.subBackground,
                        border: `1px solid ${colors.border}`,
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '13px',
                        color: colors.text,
                        whiteSpace: 'nowrap',
                      }}>
                        {campaign.genre}
                      </span>
                    )}
                  </div>

                  {/* 소개글 — 최대 3줄 말줄임 */}
                  {campaign.description && (
                    <p style={{
                      margin: '12px 0 0',
                      fontSize: '14px',
                      color: colors.text,
                      lineHeight: 1.6,
                      display: '-webkit-box' as React.CSSProperties['display'],
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
                      overflow: 'hidden',
                    }}>
                      {campaign.description}
                    </p>
                  )}

                  {/* 하단 정보: 리뷰어 수 / 마감일 / 관심 수 */}
                  <div style={{
                    marginTop: '16px',
                    display: 'flex',
                    gap: '20px',
                    flexWrap: 'wrap',
                  }}>
                    {/* 모집 마감 임박 시 빨간색으로 강조 */}
                    <span style={{
                      fontSize: '13px',
                      color: isFull ? colors.danger : colors.subText,
                      fontWeight: isFull ? 500 : 400,
                    }}>
                      리뷰어 {currentCount}/{campaign.max_reviewers}명
                    </span>
                    <span style={{ fontSize: '13px', color: colors.subText }}>
                      마감 {campaign.deadline ? formatDate(campaign.deadline) : '미정'}
                    </span>
                    {campaign.total_want_to_read != null && campaign.total_want_to_read > 0 && (
                      <span style={{ fontSize: '13px', color: colors.subText }}>
                        관심 {campaign.total_want_to_read}
                      </span>
                    )}
                  </div>

                  {/* 신청 버튼 영역 */}
                  <div style={{ marginTop: '16px' }}>
                    {isParticipating ? (
                      // 이미 참여 중인 경우
                      <span style={{ fontSize: '14px', color: colors.success, fontWeight: 500 }}>
                        이미 참여 중인 캠페인입니다
                      </span>
                    ) : isApplied ? (
                      // 방금 신청 완료된 경우
                      <span style={{ fontSize: '14px', color: colors.success, fontWeight: 500 }}>
                        ✓ 신청 완료 — 승인을 기다리는 중
                      </span>
                    ) : isFull ? (
                      // 모집 인원이 찼을 때
                      <span style={{ fontSize: '14px', color: colors.subText2 }}>
                        모집이 마감되었습니다
                      </span>
                    ) : (
                      // 신청 가능한 경우
                      <button
                        onClick={() => handleApply(campaign.id)}
                        disabled={isApplying}
                        style={{
                          background: colors.primary,
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '10px 24px',
                          borderRadius: '10px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: isApplying ? 'not-allowed' : 'pointer',
                          opacity: isApplying ? 0.7 : 1,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        {isApplying ? '신청 중...' : '참여 신청하기'}
                      </button>
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
