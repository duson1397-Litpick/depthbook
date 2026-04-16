'use client'

// 뎁스북 피드 페이지
// 리뷰어들의 공개 리뷰 목록. 비로그인도 열람 가능.
// 좋아요 / 읽고싶다 / 팔로우는 로그인 필요.
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'
import Footer from '@/components/Footer'
import { BellIcon, SearchIcon, HeartIcon, CommentIcon, BookmarkIcon } from '@/components/Icons'
import { timeAgo } from '@/lib/timeago'

// 공개 리뷰 데이터 형태
interface PublicReview {
  id: string
  title: string | null
  content: string
  rating: number
  like_count: number
  comment_count: number
  created_at: string
  reviewer_id: string
  reviewer_name: string
  campaigns: {
    id: string
    title: string
    author: string | null
    genre: string | null
    cover_image_path: string | null
    total_want_to_read: number | null
  } | null
}

// 날짜를 "YYYY.MM.DD" 형태로 변환
function formatDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

// 댓글 데이터 형태
interface ReviewComment {
  id: string
  content: string
  created_at: string
  user_id: string
  user_name: string
}

// 이름 첫 글자 추출 (프로필 원형용)
function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

export default function FeedPage() {
  const router = useRouter()
  const supabase = createClient()

  // 로그인 상태
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState('')

  // 리뷰 목록
  const [reviews, setReviews] = useState<PublicReview[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)

  // 좋아요 / 읽고싶다 / 팔로우 상태 (id 집합)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [wtrIds, setWtrIds] = useState<Set<string>>(new Set())
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())

  // 더 보기 버튼 호버
  const [moreHover, setMoreHover] = useState(false)

  // 로그인 모달
  const [showLoginModal, setShowLoginModal] = useState(false)

  // 카드별 본문 펼침 상태 (review.id → 펼침 여부)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 로그아웃 버튼 호버
  const [logoutHover, setLogoutHover] = useState(false)

  // 캠페인 링크 호버 (내비게이션 바)
  const [campaignNavHover, setCampaignNavHover] = useState(false)

  // 리뷰어 이름 호버 상태 (review.id 기준)
  const [hoveredReviewerId, setHoveredReviewerId] = useState<string | null>(null)

  // 댓글 영역이 열린 리뷰 id (한 번에 하나)
  const [openCommentId, setOpenCommentId] = useState<string | null>(null)

  // 리뷰별 댓글 목록 (review.id → 댓글 배열)
  const [commentsMap, setCommentsMap] = useState<Record<string, ReviewComment[]>>({})

  // 댓글 로딩 중인 리뷰 id
  const [commentLoadingId, setCommentLoadingId] = useState<string | null>(null)

  // 댓글 입력값 (review.id → 입력 문자열)
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})

  // 댓글 전송 중인 리뷰 id
  const [commentSubmittingId, setCommentSubmittingId] = useState<string | null>(null)

  // 댓글 인풋 포커스 상태 (review.id 기준)
  const [commentFocusedId, setCommentFocusedId] = useState<string | null>(null)

  // 모바일 여부 (768px 미만)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // 검색어 입력값
  const [searchQuery, setSearchQuery] = useState('')

  // 300ms 디바운스 적용된 검색어
  const [searchDebounced, setSearchDebounced] = useState('')

  // ⋯ 드롭다운이 열린 리뷰 id
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // 신고 모달 상태
  const [reportReviewId, setReportReviewId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDetail, setReportDetail] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportDone, setReportDone] = useState(false)

  // 알림 상태
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifDropdown, setShowNotifDropdown] = useState(false)

  // ── 검색어 디바운스 처리 (300ms) ────────────────
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  // 디바운스 검색어 변경 시 리뷰 다시 불러오기
  useEffect(() => {
    // 초기 로드 완료 후에만 실행 (loading 중에는 init()에서 처리)
    if (loading) return
    setPage(0)
    setReviews([])
    loadReviews(0, currentUserId, searchDebounced)
  }, [searchDebounced])

  // ── 초기 데이터 로드 ────────────────────────────
  useEffect(() => {
    const init = async () => {
      // 로그인 상태 확인 (실패해도 무시, 비로그인도 리뷰 열람 가능)
      const { data: { user } } = await supabase.auth.getUser()
      let userId: string | null = null

      if (user) {
        userId = user.id
        setCurrentUserId(user.id)

        // 현재 사용자 이름 조회
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('id', user.id)
          .single()
        setCurrentUserName(profile?.name || profile?.email || user.email || '')

        // 내가 좋아요한 리뷰 id 목록
        const { data: likes } = await supabase
          .from('review_likes')
          .select('public_review_id')
          .eq('user_id', user.id)
        setLikedIds(new Set((likes ?? []).map((l: any) => l.public_review_id as string)))

        // 내가 팔로우한 리뷰어 id 목록
        const { data: follows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
        setFollowingIds(new Set((follows ?? []).map((f: any) => f.following_id as string)))

        // 내가 읽고싶다 한 캠페인 id 목록
        const { data: wtr } = await supabase
          .from('want_to_read')
          .select('campaign_id')
          .eq('user_id', user.id)
        setWtrIds(new Set((wtr ?? []).map((w: any) => w.campaign_id as string)))

        // 알림 목록 로드
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const notifRes = await fetch('/api/notifications', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          if (notifRes.ok) {
            const notifData = await notifRes.json()
            setNotifications(notifData.notifications ?? [])
            setUnreadCount(notifData.unreadCount ?? 0)
          }
        }
      }

      await loadReviews(0, userId, '')
      setLoading(false)
    }

    init()
  }, [])

  // ── 리뷰 목록 조회 ──────────────────────────────
  const loadReviews = async (pageNum: number, userId: string | null, query = '') => {
    const from = pageNum * 20
    const to = from + 19

    // 기본 쿼리 구성
    let q = supabase
      .from('public_reviews')
      .select(`
        id,
        title,
        content,
        rating,
        like_count,
        comment_count,
        created_at,
        reviewer_id,
        campaigns (
          id,
          title,
          author,
          genre,
          cover_image_path,
          total_want_to_read
        )
      `)

    // 검색어가 있으면 제목 또는 본문에서 검색
    if (query.trim()) {
      q = q.or(`title.ilike.%${query.trim()}%,content.ilike.%${query.trim()}%`)
    }

    const { data } = await q
      .order('created_at', { ascending: false })
      .range(from, to)

    if (!data || data.length === 0) {
      if (pageNum === 0) setReviews([])
      setHasMore(false)
      return
    }

    // 리뷰어 이름 일괄 조회
    // reviewer_id → reviewer_profiles → profiles 순서로 시도
    const reviewerIds = Array.from(new Set(data.map((r: any) => r.reviewer_id as string)))

    const { data: reviewerProfiles } = await supabase
      .from('reviewer_profiles')
      .select('id, name, email')
      .in('id', reviewerIds)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', reviewerIds)

    // profiles → reviewer_profiles 순서로 덮어쓰기 (더 구체적인 데이터 우선)
    const profileMap: Record<string, string> = {}
    ;(profiles ?? []).forEach((p: any) => {
      profileMap[p.id] = p.name || p.email || '익명'
    })
    ;(reviewerProfiles ?? []).forEach((p: any) => {
      if (p.name || p.email) profileMap[p.id] = p.name || p.email
    })

    const mapped: PublicReview[] = data.map((r: any) => ({
      id: r.id,
      title: r.title ?? null,
      content: r.content,
      rating: r.rating,
      like_count: r.like_count ?? 0,
      comment_count: r.comment_count ?? 0,
      created_at: r.created_at,
      reviewer_id: r.reviewer_id,
      reviewer_name: profileMap[r.reviewer_id] ?? '익명',
      // campaigns가 배열로 올 수도 있어서 첫 번째 항목 사용
      campaigns: Array.isArray(r.campaigns)
        ? (r.campaigns[0] ?? null)
        : (r.campaigns ?? null),
    }))

    if (pageNum === 0) {
      setReviews(mapped)
    } else {
      setReviews((prev) => [...prev, ...mapped])
    }

    setHasMore(data.length === 20)
  }

  // ── 더 보기 ─────────────────────────────────────
  const handleLoadMore = async () => {
    setLoadingMore(true)
    const next = page + 1
    setPage(next)
    await loadReviews(next, currentUserId, searchDebounced)
    setLoadingMore(false)
  }

  // ── 로그아웃 ────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setCurrentUserId(null)
    setCurrentUserName('')
    setLikedIds(new Set())
    setFollowingIds(new Set())
    setWtrIds(new Set())
  }

  // ── 인증 토큰 가져오기 (API 호출용) ─────────────
  const getAuthHeader = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? `Bearer ${session.access_token}` : null
  }

  // ── 알림 읽음 처리 ──────────────────────────────
  const handleReadNotification = async (notifId: string) => {
    const auth = await getAuthHeader()
    if (!auth) return
    setNotifications((prev) =>
      prev.map((n) => n.id === notifId ? { ...n, is_read: true } : n)
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ notificationId: notifId }),
    })
    setShowNotifDropdown(false)
  }

  // ── 전체 알림 읽음 처리 ──────────────────────────
  const handleMarkAllRead = async () => {
    const auth = await getAuthHeader()
    if (!auth) return
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ markAllRead: true }),
    })
  }

  // ── 로그인이 필요한 동작 공통 처리 ──────────────
  const requireLogin = (action: () => void) => {
    if (!currentUserId) {
      setShowLoginModal(true)
      return
    }
    action()
  }

  // ── 좋아요 토글 (낙관적 업데이트) ───────────────
  const handleLike = (reviewId: string) => {
    requireLogin(async () => {
      const auth = await getAuthHeader()
      if (!auth) return

      const wasLiked = likedIds.has(reviewId)
      setLikedIds((prev) => {
        const next = new Set(prev)
        wasLiked ? next.delete(reviewId) : next.add(reviewId)
        return next
      })
      setReviews((prev) => prev.map((r) =>
        r.id === reviewId
          ? { ...r, like_count: r.like_count + (wasLiked ? -1 : 1) }
          : r
      ))

      const res = await fetch('/api/feed/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ reviewId }),
      })
      // 실패 시 되돌리기
      if (!res.ok) {
        setLikedIds((prev) => {
          const next = new Set(prev)
          wasLiked ? next.add(reviewId) : next.delete(reviewId)
          return next
        })
        setReviews((prev) => prev.map((r) =>
          r.id === reviewId
            ? { ...r, like_count: r.like_count + (wasLiked ? 1 : -1) }
            : r
        ))
      }
    })
  }

  // ── 읽고싶다 토글 (낙관적 업데이트) ─────────────
  const handleWantToRead = (campaignId: string) => {
    requireLogin(async () => {
      const auth = await getAuthHeader()
      if (!auth) return

      const wasAdded = wtrIds.has(campaignId)
      setWtrIds((prev) => {
        const next = new Set(prev)
        wasAdded ? next.delete(campaignId) : next.add(campaignId)
        return next
      })

      const res = await fetch('/api/feed/want-to-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ campaignId }),
      })
      if (!res.ok) {
        setWtrIds((prev) => {
          const next = new Set(prev)
          wasAdded ? next.add(campaignId) : next.delete(campaignId)
          return next
        })
      }
    })
  }

  // ── 팔로우 토글 (낙관적 업데이트) ───────────────
  const handleFollow = (reviewerId: string) => {
    requireLogin(async () => {
      const auth = await getAuthHeader()
      if (!auth) return

      const wasFollowing = followingIds.has(reviewerId)
      setFollowingIds((prev) => {
        const next = new Set(prev)
        wasFollowing ? next.delete(reviewerId) : next.add(reviewerId)
        return next
      })

      const res = await fetch('/api/feed/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify({ reviewerId }),
      })
      if (!res.ok) {
        setFollowingIds((prev) => {
          const next = new Set(prev)
          wasFollowing ? next.add(reviewerId) : next.delete(reviewerId)
          return next
        })
      }
    })
  }

  // ── 본문 펼침 토글 ──────────────────────────────
  const toggleExpand = (reviewId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      prev.has(reviewId) ? next.delete(reviewId) : next.add(reviewId)
      return next
    })
  }

  // ── 댓글 영역 토글 ──────────────────────────────
  const toggleComments = async (reviewId: string) => {
    // 이미 열려있으면 닫기
    if (openCommentId === reviewId) {
      setOpenCommentId(null)
      return
    }

    setOpenCommentId(reviewId)

    // 이미 댓글 데이터가 있으면 다시 불러오지 않음
    if (commentsMap[reviewId]) return

    setCommentLoadingId(reviewId)
    try {
      const res = await fetch(`/api/feed/comment?reviewId=${reviewId}`)
      if (res.ok) {
        const { comments } = await res.json()
        setCommentsMap((prev) => ({ ...prev, [reviewId]: comments ?? [] }))
      }
    } finally {
      setCommentLoadingId(null)
    }
  }

  // ── 댓글 전송 ───────────────────────────────────
  const handleCommentSubmit = async (reviewId: string) => {
    const content = commentInputs[reviewId]?.trim()
    if (!content || commentSubmittingId) return

    const auth = await getAuthHeader()
    if (!auth) return

    setCommentSubmittingId(reviewId)

    const res = await fetch('/api/feed/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({ reviewId, content }),
    })

    setCommentSubmittingId(null)

    if (res.ok) {
      const { comment } = await res.json()
      // 낙관적 업데이트: 목록에 즉시 추가
      setCommentsMap((prev) => ({
        ...prev,
        [reviewId]: [...(prev[reviewId] ?? []), comment],
      }))
      // comment_count 즉시 +1
      setReviews((prev) => prev.map((r) =>
        r.id === reviewId ? { ...r, comment_count: r.comment_count + 1 } : r
      ))
      // 입력창 초기화
      setCommentInputs((prev) => ({ ...prev, [reviewId]: '' }))
    } else {
      const body = await res.json().catch(() => ({}))
      alert(body.error ?? '댓글 전송에 실패했습니다.')
    }
  }

  // ── 신고 모달 열기 ──────────────────────────────
  const openReportModal = (reviewId: string) => {
    setReportReviewId(reviewId)
    setReportReason('')
    setReportDetail('')
    setReportDone(false)
    setReportSubmitting(false)
    setOpenMenuId(null)
  }

  // ── 신고 제출 ───────────────────────────────────
  const handleReport = async () => {
    if (!reportReviewId || !reportReason || reportSubmitting) return
    setReportSubmitting(true)

    const auth = await getAuthHeader()
    if (!auth) {
      // 로그인 필요 → 신고 모달 닫고 로그인 모달 열기
      setReportReviewId(null)
      setReportSubmitting(false)
      setShowLoginModal(true)
      return
    }

    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        reviewId: reportReviewId,
        reason: reportReason,
        detail: reportDetail.trim(),
      }),
    })

    setReportSubmitting(false)

    if (res.ok) {
      setReportDone(true)
    } else {
      const body = await res.json().catch(() => ({}))
      // 중복 신고(409) 메시지 포함해서 표시
      alert(body.error ?? '신고에 실패했습니다.')
    }
  }

  // ── 로딩 화면 ───────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: colors.background,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '15px', color: colors.subText,
      }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ flex: 1, background: colors.background, display: 'flex', flexDirection: 'column' }}>

      {/* 고정 네비게이션 바 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#FFFFFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        height: '60px',
      }}>
        <div style={{
          maxWidth: '720px', margin: '0 auto', padding: '0 20px',
          height: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* 왼쪽: 로고 + 캠페인 링크 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ cursor: 'pointer' }} onClick={() => router.push('/feed')}>
              <Logo size="small" />
            </div>
            <Link
              href="/reviewer/campaigns"
              onMouseEnter={() => setCampaignNavHover(true)}
              onMouseLeave={() => setCampaignNavHover(false)}
              style={{
                fontSize: '14px', textDecoration: 'none',
                color: campaignNavHover ? colors.primary : colors.subText,
                transition: 'color 0.15s',
              }}
            >
              캠페인
            </Link>
          </div>

          {currentUserId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

              {/* 알림 아이콘 */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowNotifDropdown((v) => !v)}
                  style={{
                    background: 'none', border: 'none',
                    cursor: 'pointer', padding: '4px', lineHeight: 1,
                    position: 'relative',
                    color: unreadCount > 0 ? colors.primary : colors.subText,
                    display: 'flex', alignItems: 'center',
                    transition: 'color 0.15s',
                  }}
                  title="알림"
                >
                  <BellIcon size={22} />
                  {/* 읽지 않은 알림 빨간 점 */}
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: '2px', right: '2px',
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: colors.danger,
                      display: 'block',
                    }} />
                  )}
                </button>

                {/* 알림 드롭다운 */}
                {showNotifDropdown && (
                  <>
                    {/* 드롭다운 바깥 클릭 시 닫기 */}
                    <div
                      onClick={() => setShowNotifDropdown(false)}
                      style={{
                        position: 'fixed', inset: 0, zIndex: 90,
                      }}
                    />
                    <div style={{
                      position: 'absolute', top: '40px', right: 0,
                      width: isMobile ? 'calc(100vw - 32px)' : '360px',
                      maxWidth: isMobile ? 'calc(100vw - 32px)' : '360px',
                      maxHeight: '400px', overflowY: 'auto',
                      background: '#FFFFFF',
                      borderRadius: '12px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                      border: `1px solid ${colors.border}`,
                      zIndex: 200,
                    }}>
                      {/* 드롭다운 헤더 */}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderBottom: `1px solid ${colors.border}`,
                        position: 'sticky', top: 0, background: '#FFFFFF',
                      }}>
                        <span style={{ fontSize: '16px', fontWeight: 600, color: colors.titleText }}>
                          알림
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            style={{
                              background: 'none', border: 'none',
                              fontSize: '13px', color: colors.primary,
                              cursor: 'pointer', padding: 0,
                            }}
                          >
                            모두 읽음
                          </button>
                        )}
                      </div>

                      {/* 알림 목록 */}
                      {notifications.length === 0 ? (
                        <div style={{
                          padding: '40px 20px', textAlign: 'center',
                          fontSize: '14px', color: colors.subText,
                        }}>
                          새 알림이 없습니다
                        </div>
                      ) : (
                        notifications.map((notif, idx) => (
                          <div
                            key={notif.id}
                            onClick={() => handleReadNotification(notif.id)}
                            style={{
                              padding: '14px 16px',
                              background: notif.is_read ? 'none' : '#F0F4FF',
                              borderBottom: idx < notifications.length - 1
                                ? `1px solid ${colors.border}` : 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <p style={{
                              margin: 0, fontSize: '14px', color: colors.text,
                              lineHeight: 1.5,
                            }}>
                              {notif.message}
                            </p>
                            <p style={{
                              margin: '4px 0 0', fontSize: '12px', color: colors.subText2,
                            }}>
                              {timeAgo(notif.created_at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <span style={{ fontSize: '14px', color: colors.text }}>
                {currentUserName}
              </span>
              <button
                onClick={handleLogout}
                onMouseEnter={() => setLogoutHover(true)}
                onMouseLeave={() => setLogoutHover(false)}
                style={{
                  background: 'none', border: 'none', fontSize: '13px',
                  color: logoutHover ? colors.text : colors.subText,
                  cursor: 'pointer', padding: 0, transition: 'color 0.15s',
                }}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              style={{
                background: 'none', border: 'none', fontSize: '14px',
                color: colors.primary, cursor: 'pointer',
                fontWeight: 600, padding: 0,
              }}
            >
              로그인
            </button>
          )}
        </div>
      </div>

      {/* 피드 본문 — flex: 1 로 남은 공간을 채워 푸터를 바닥에 붙임 */}
      <div style={{ flex: 1, maxWidth: '720px', width: '100%', margin: '0 auto', padding: isMobile ? '0 16px 60px' : '0 20px 60px', boxSizing: 'border-box' }}>

        {/* 피드 헤더 */}
        <div style={{ paddingTop: '32px', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: colors.titleText }}>
            독자들의 솔직한 리뷰
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>
            출판 전 원고를 읽은 리뷰어들의 생생한 후기
          </p>
        </div>

        {/* 검색 바 */}
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          {/* 돋보기 아이콘 */}
          <span style={{
            position: 'absolute', left: '14px', top: '50%',
            transform: 'translateY(-50%)',
            color: colors.subText2,
            pointerEvents: 'none', lineHeight: 1,
            display: 'flex', alignItems: 'center',
          }}>
            <SearchIcon size={18} />
          </span>
          <input
            type="text"
            placeholder="리뷰 제목 또는 내용 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', height: '46px',
              borderRadius: '22px',
              border: `1px solid ${colors.border}`,
              paddingLeft: '44px', paddingRight: '16px',
              fontSize: '15px', outline: 'none',
              boxSizing: 'border-box',
              background: '#FFFFFF',
              color: colors.text,
            }}
          />
        </div>

        {/* 리뷰 목록 */}
        {reviews.length === 0 ? (
          <div style={{ ...styles.card, padding: '60px 20px', textAlign: 'center' }}>
            {searchDebounced ? (
              <>
                <p style={{ margin: '0 0 8px', fontSize: '16px', color: colors.subText }}>
                  검색 결과가 없습니다
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: colors.subText2 }}>
                  다른 키워드로 검색해보세요
                </p>
              </>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: '16px', color: colors.subText }}>
                  아직 리뷰가 없습니다
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: colors.subText2 }}>
                  곧 리뷰어들의 솔직한 리뷰가 올라옵니다
                </p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {reviews.map((review) => {
              const isExpanded = expandedIds.has(review.id)
              const isLiked = likedIds.has(review.id)
              const isFollowing = followingIds.has(review.reviewer_id)
              const isMyReview = review.reviewer_id === currentUserId
              const camp = review.campaigns
              const isWtr = camp ? wtrIds.has(camp.id) : false
              const metaText = [camp?.author, camp?.genre].filter(Boolean).join(' · ')
              // 200자 초과 시 접기 적용
              const isLong = review.content.length > 200

              return (
                <div key={review.id} style={{ ...styles.card, padding: isMobile ? '16px' : '24px', position: 'relative' }}>

                  {/* ⋯ 더보기 버튼 (오른쪽 상단 절대 위치) */}
                  <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === review.id ? null : review.id)
                      }}
                      style={{
                        background: 'none', border: 'none', padding: '4px 8px',
                        fontSize: '18px', color: colors.subText2,
                        cursor: 'pointer', lineHeight: 1, borderRadius: '6px',
                      }}
                      title="더보기"
                    >
                      ···
                    </button>

                    {/* 드롭다운 메뉴 */}
                    {openMenuId === review.id && (
                      <>
                        {/* 바깥 클릭 시 닫기 */}
                        <div
                          onClick={() => setOpenMenuId(null)}
                          style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                        />
                        <div style={{
                          position: 'absolute', top: '32px', right: 0,
                          background: '#FFFFFF', borderRadius: '10px',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                          border: `1px solid ${colors.border}`,
                          zIndex: 200, minWidth: '120px', overflow: 'hidden',
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              requireLogin(() => openReportModal(review.id))
                            }}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left',
                              padding: '12px 16px', background: 'none', border: 'none',
                              fontSize: '14px', color: colors.danger,
                              cursor: 'pointer',
                            }}
                          >
                            신고하기
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 리뷰어 정보 영역 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingRight: '40px' }}>
                    {/* 프로필 원형 */}
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: colors.primary, color: '#FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', fontWeight: 600, flexShrink: 0,
                    }}>
                      {getInitial(review.reviewer_name)}
                    </div>

                    {/* 이름 + 날짜 */}
                    <div style={{ flex: 1 }}>
                      <p
                        onClick={() => router.push(`/reviewer/profile/${review.reviewer_id}`)}
                        onMouseEnter={() => setHoveredReviewerId(review.id)}
                        onMouseLeave={() => setHoveredReviewerId(null)}
                        style={{
                          margin: 0, fontSize: '15px', fontWeight: 600,
                          color: hoveredReviewerId === review.id ? colors.primary : colors.titleText,
                          cursor: 'pointer', transition: 'color 0.15s',
                        }}
                      >
                        {review.reviewer_name}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: '13px', color: colors.subText2 }}>
                        {timeAgo(review.created_at)}
                      </p>
                    </div>

                    {/* 팔로우 버튼: 본인이 아닐 때만 */}
                    {!isMyReview && (
                      <button
                        onClick={() => handleFollow(review.reviewer_id)}
                        style={{
                          padding: '4px 14px', borderRadius: '16px',
                          fontSize: '13px', cursor: 'pointer', fontWeight: 500,
                          border: isFollowing ? 'none' : `1px solid ${colors.primary}`,
                          background: isFollowing ? colors.primary : 'none',
                          color: isFollowing ? '#FFFFFF' : colors.primary,
                          transition: 'all 0.15s',
                        }}
                      >
                        {isFollowing ? '팔로잉' : '팔로우'}
                      </button>
                    )}
                  </div>

                  {/* 원고 정보 박스 */}
                  {camp && (
                    <div style={{
                      marginTop: '16px',
                      background: colors.subBackground,
                      borderRadius: '12px', padding: '16px',
                    }}>
                      <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.titleText }}>
                        {camp.title}
                      </p>
                      {metaText && (
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.subText }}>
                          {metaText}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 리뷰 내용 영역 */}
                  <div style={{ marginTop: '16px' }}>
                    {/* 리뷰 제목 */}
                    {review.title && (
                      <p style={{
                        margin: '0 0 8px', fontSize: '16px', fontWeight: 600,
                        color: colors.titleText,
                      }}>
                        {review.title}
                      </p>
                    )}

                    {/* 리뷰 본문 */}
                    <div style={{ position: 'relative' }}>
                      <p style={{
                        margin: 0, fontSize: '15px', color: colors.text,
                        lineHeight: 1.7, whiteSpace: 'pre-wrap',
                        ...(isLong && !isExpanded
                          ? { maxHeight: '8.5em', overflow: 'hidden' }
                          : {}),
                      }}>
                        {review.content}
                      </p>

                      {/* 접힌 상태 하단 그라데이션 */}
                      {isLong && !isExpanded && (
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          height: '40px',
                          background: 'linear-gradient(to bottom, rgba(255,255,255,0), #FFFFFF)',
                          pointerEvents: 'none',
                        }} />
                      )}
                    </div>

                    {/* 더 보기 / 접기 */}
                    {isLong && (
                      <button
                        onClick={() => toggleExpand(review.id)}
                        style={{
                          background: 'none', border: 'none', padding: '4px 0',
                          marginTop: '4px', fontSize: '14px',
                          color: colors.primary, cursor: 'pointer', fontWeight: 500,
                        }}
                      >
                        {isExpanded ? '접기' : '더 보기'}
                      </button>
                    )}

                    {/* 별점 */}
                    <div style={{ marginTop: '12px' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} style={{
                          fontSize: '14px',
                          color: s <= review.rating ? '#FBBF24' : colors.border,
                        }}>★</span>
                      ))}
                    </div>
                  </div>

                  {/* 하단 동작 버튼 영역 */}
                  <div style={{
                    marginTop: '16px', paddingTop: '16px',
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex', gap: '20px', alignItems: 'center',
                  }}>
                    {/* 좋아요 */}
                    <button
                      onClick={() => handleLike(review.id)}
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        cursor: 'pointer',
                        color: isLiked ? colors.danger : colors.subText,
                        display: 'flex', alignItems: 'center', gap: '5px',
                        transition: 'color 0.15s',
                      }}
                    >
                      <HeartIcon size={20} filled={isLiked} />
                      <span style={{ fontSize: '14px' }}>{review.like_count}</span>
                    </button>

                    {/* 댓글 버튼 — 클릭 시 댓글 영역 펼침/접힘 */}
                    <button
                      onClick={() => toggleComments(review.id)}
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        cursor: 'pointer',
                        color: openCommentId === review.id ? colors.primary : colors.subText,
                        display: 'flex', alignItems: 'center', gap: '5px',
                        transition: 'color 0.15s', fontSize: '14px',
                      }}
                    >
                      <CommentIcon size={20} />
                      <span>{review.comment_count}</span>
                    </button>

                    {/* 읽고싶다 */}
                    {camp && (
                      <button
                        onClick={() => handleWantToRead(camp.id)}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          fontSize: '14px', cursor: 'pointer',
                          color: isWtr ? colors.primary : colors.subText,
                          fontWeight: isWtr ? 600 : 400,
                          display: 'flex', alignItems: 'center', gap: '5px',
                          transition: 'color 0.15s',
                        }}
                      >
                        <BookmarkIcon size={20} filled={isWtr} />
                        <span>{camp.total_want_to_read ?? 0}</span>
                      </button>
                    )}
                  </div>

                  {/* 댓글 영역 — 댓글 버튼 클릭 시 펼쳐짐 */}
                  {openCommentId === review.id && (
                    <div style={{
                      borderTop: `1px solid ${colors.border}`,
                      marginTop: '16px', paddingTop: '16px',
                    }}>

                      {/* 댓글 목록 */}
                      {commentLoadingId === review.id ? (
                        <p style={{
                          margin: 0, fontSize: '14px', color: colors.subText2,
                          textAlign: 'center', padding: '20px 0',
                        }}>
                          불러오는 중...
                        </p>
                      ) : (commentsMap[review.id] ?? []).length === 0 ? (
                        <p style={{
                          margin: 0, fontSize: '14px', color: colors.subText2,
                          textAlign: 'center', padding: '20px 0',
                        }}>
                          아직 댓글이 없습니다
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {(commentsMap[review.id] ?? []).map((comment) => (
                            <div key={comment.id} style={{ display: 'flex', gap: '10px' }}>
                              {/* 프로필 원형 — 모바일에서 28px로 줄임 */}
                              <div style={{
                                width: isMobile ? '28px' : '32px',
                                height: isMobile ? '28px' : '32px',
                                borderRadius: '50%',
                                background: colors.primary, color: '#FFFFFF',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '13px', fontWeight: 600, flexShrink: 0,
                              }}>
                                {getInitial(comment.user_name)}
                              </div>
                              {/* 내용 */}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                  <span style={{
                                    fontSize: '14px', fontWeight: 600, color: colors.titleText,
                                  }}>
                                    {comment.user_name}
                                  </span>
                                  <span style={{
                                    fontSize: '12px', color: colors.subText2, marginLeft: '8px',
                                  }}>
                                    {timeAgo(comment.created_at)}
                                  </span>
                                </div>
                                <p style={{
                                  margin: '4px 0 0', fontSize: '14px',
                                  color: colors.text, lineHeight: 1.5,
                                }}>
                                  {comment.content}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 댓글 입력 영역 */}
                      <div style={{ marginTop: '16px' }}>
                        {currentUserId ? (
                          // 로그인 상태: 입력창 표시
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <input
                              type="text"
                              placeholder="댓글을 입력하세요"
                              value={commentInputs[review.id] ?? ''}
                              onChange={(e) => setCommentInputs((prev) => ({
                                ...prev, [review.id]: e.target.value,
                              }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommentSubmit(review.id)
                              }}
                              onFocus={() => setCommentFocusedId(review.id)}
                              onBlur={() => setCommentFocusedId(null)}
                              style={{
                                flex: 1, height: '40px',
                                borderRadius: '20px', padding: '0 16px',
                                border: commentFocusedId === review.id
                                  ? `1px solid ${colors.primary}`
                                  : `1px solid ${colors.border}`,
                                fontSize: '14px', outline: 'none',
                                transition: 'border-color 0.15s',
                                boxSizing: 'border-box',
                              }}
                            />
                            <button
                              onClick={() => handleCommentSubmit(review.id)}
                              disabled={!(commentInputs[review.id]?.trim()) || commentSubmittingId === review.id}
                              style={{
                                background: 'none', border: 'none', padding: 0,
                                fontSize: '14px', fontWeight: 600,
                                color: (commentInputs[review.id]?.trim() && commentSubmittingId !== review.id)
                                  ? colors.primary : colors.subText2,
                                cursor: (commentInputs[review.id]?.trim() && commentSubmittingId !== review.id)
                                  ? 'pointer' : 'default',
                                transition: 'color 0.15s',
                                flexShrink: 0,
                              }}
                            >
                              게시
                            </button>
                          </div>
                        ) : (
                          // 비로그인: 로그인 안내
                          <p
                            onClick={() => setShowLoginModal(true)}
                            style={{
                              margin: 0, fontSize: '13px', color: colors.subText,
                              cursor: 'pointer', textAlign: 'center', padding: '8px 0',
                            }}
                          >
                            댓글을 쓰려면 로그인하세요
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* 더 보기 버튼 */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  onMouseEnter={() => setMoreHover(true)}
                  onMouseLeave={() => setMoreHover(false)}
                  style={{
                    background: moreHover && !loadingMore ? colors.subBackground : 'none',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '10px', padding: '12px 32px',
                    fontSize: '14px', fontWeight: 500,
                    color: loadingMore ? colors.subText2 : colors.text,
                    cursor: loadingMore ? 'default' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {loadingMore ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 푸터 */}
      <Footer />

      {/* 신고 모달 */}
      {reportReviewId && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setReportReviewId(null) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px',
          }}
        >
          <div style={{
            width: '100%', maxWidth: '440px',
            ...styles.card, padding: '32px',
            boxSizing: 'border-box', position: 'relative',
          }}>
            {/* 닫기 버튼 */}
            <button
              onClick={() => setReportReviewId(null)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'none', border: 'none',
                fontSize: '18px', color: colors.subText,
                cursor: 'pointer', lineHeight: 1,
              }}
            >
              ✕
            </button>

            {reportDone ? (
              /* 신고 완료 화면 */
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <p style={{ fontSize: '40px', margin: '0 0 16px', lineHeight: 1 }}>✅</p>
                <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
                  신고가 접수되었습니다
                </p>
                <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.subText }}>
                  검토 후 조치를 취할게요
                </p>
                <button
                  onClick={() => setReportReviewId(null)}
                  style={{
                    padding: '10px 32px', borderRadius: '10px',
                    background: colors.primary, color: '#FFFFFF',
                    border: 'none', fontSize: '15px', fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  확인
                </button>
              </div>
            ) : (
              /* 신고 사유 선택 화면 */
              <>
                <p style={{ margin: '0 0 24px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
                  리뷰 신고
                </p>

                {/* 신고 사유 선택 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { value: 'spam',         label: '스팸 또는 광고' },
                    { value: 'spoiler',      label: '스포일러 포함' },
                    { value: 'inappropriate',label: '부적절한 내용' },
                    { value: 'etc',          label: '기타' },
                  ].map(({ value, label }) => (
                    <label
                      key={value}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        cursor: 'pointer', fontSize: '15px', color: colors.text,
                      }}
                    >
                      <input
                        type="radio"
                        name="reportReason"
                        value={value}
                        checked={reportReason === value}
                        onChange={() => setReportReason(value)}
                        style={{ accentColor: colors.primary, width: '16px', height: '16px' }}
                      />
                      {label}
                    </label>
                  ))}
                </div>

                {/* '기타' 선택 시 상세 입력 */}
                {reportReason === 'etc' && (
                  <textarea
                    placeholder="신고 사유를 입력하세요"
                    value={reportDetail}
                    onChange={(e) => setReportDetail(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%', borderRadius: '10px',
                      border: `1px solid ${colors.border}`,
                      padding: '12px 14px', fontSize: '14px',
                      color: colors.text, resize: 'vertical',
                      outline: 'none', boxSizing: 'border-box',
                      marginBottom: '16px',
                    }}
                  />
                )}

                {/* 신고 버튼 */}
                <button
                  onClick={handleReport}
                  disabled={!reportReason || reportSubmitting}
                  style={{
                    width: '100%', height: '48px', borderRadius: '12px',
                    background: !reportReason || reportSubmitting
                      ? colors.subBackground : colors.danger,
                    color: !reportReason || reportSubmitting ? colors.subText2 : '#FFFFFF',
                    border: 'none', fontSize: '15px', fontWeight: 600,
                    cursor: !reportReason || reportSubmitting ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {reportSubmitting ? '신고 중...' : '신고하기'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 로그인 모달 */}
      {showLoginModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowLoginModal(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px',
          }}
        >
          <div style={{
            width: '100%', maxWidth: '400px',
            ...styles.card, padding: '32px', position: 'relative',
            boxSizing: 'border-box',
          }}>
            {/* 닫기 버튼 */}
            <button
              onClick={() => setShowLoginModal(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'none', border: 'none',
                fontSize: '18px', color: colors.subText,
                cursor: 'pointer', lineHeight: 1,
              }}
            >
              ✕
            </button>

            {/* 로고 */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <Logo size="medium" />
            </div>

            <p style={{
              margin: '0 0 24px', fontSize: '18px', fontWeight: 600,
              color: colors.titleText, textAlign: 'center',
            }}>
              로그인하고 참여하세요
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => router.push('/publisher/login')}
                style={{
                  width: '100%', height: '48px', borderRadius: '12px',
                  background: colors.primary, color: '#FFFFFF',
                  border: 'none', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                출판사로 로그인
              </button>
              <button
                onClick={() => router.push('/reviewer/login')}
                style={{
                  width: '100%', height: '48px', borderRadius: '12px',
                  background: 'none', color: colors.primary,
                  border: `1px solid ${colors.primary}`,
                  fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                리뷰어로 로그인
              </button>
              <button
                onClick={() => router.push('/reader/signup?redirect=/feed')}
                style={{
                  width: '100%', height: '48px', borderRadius: '12px',
                  background: 'none', color: colors.text,
                  border: `1px solid ${colors.border}`,
                  fontSize: '15px', fontWeight: 500, cursor: 'pointer',
                }}
              >
                독자로 가입하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
