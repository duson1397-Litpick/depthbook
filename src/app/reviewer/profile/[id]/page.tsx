'use client'

// 리뷰어 공개 프로필 페이지
// 누구나 열람 가능. 리뷰 목록, 팔로워 수, 등급 표시.
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

// 등급별 표시 텍스트
const GRADE_LABELS: Record<string, string> = {
  bronze:   '🥉 브론즈',
  silver:   '🥈 실버',
  gold:     '🥇 골드',
  platinum: '💎 플래티넘',
}

// 별점을 ★☆ 문자로 변환
function renderStars(rating: number): string {
  const full = Math.round(rating)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

// YYYY.MM.DD 형식으로 날짜 변환
function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 이름 첫 글자 추출 (프로필 원형용)
function getInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase()
}

// 공개 리뷰 데이터 형태
interface PublicReview {
  id: string
  title: string | null
  content: string
  rating: number
  like_count: number
  comment_count: number
  created_at: string
  campaigns: {
    id: string
    title: string
    author: string | null
    genre: string | null
  } | null
}

export default function ReviewerProfilePage({ params }: { params: { id: string } }) {
  const reviewerId = params.id
  const router = useRouter()
  const supabase = createClient()

  // 페이지 로딩 중 여부
  const [loading, setLoading] = useState(true)

  // 프로필 없음 여부
  const [notFound, setNotFound] = useState(false)

  // 기본 프로필 정보
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  // 리뷰어 상세 프로필
  const [bio, setBio] = useState<string | null>(null)
  const [preferredGenres, setPreferredGenres] = useState<string[]>([])
  const [grade, setGrade] = useState<string | null>(null)
  const [totalReviews, setTotalReviews] = useState(0)
  const [isPublic, setIsPublic] = useState(true)

  // 팔로워 수
  const [followerCount, setFollowerCount] = useState(0)

  // 공개 리뷰 목록
  const [reviews, setReviews] = useState<PublicReview[]>([])

  // 현재 로그인한 유저 id (없으면 null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // 팔로우 상태
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  // 뒤로가기 버튼 호버 상태
  const [backHover, setBackHover] = useState(false)

  // ── 페이지 데이터 로드 ──────────────────────────
  useEffect(() => {
    const init = async () => {
      // 로그인 상태 확인 (실패해도 무시 — 비로그인도 열람 가능)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)

      // 기본 프로필 조회
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', reviewerId)
        .single()

      if (!profileData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setName(profileData.name ?? profileData.email ?? '익명')
      setEmail(profileData.email ?? '')

      // 리뷰어 상세 프로필 조회
      const { data: rp } = await supabase
        .from('reviewer_profiles')
        .select('bio, preferred_genres, grade, total_reviews, is_public')
        .eq('id', reviewerId)
        .single()

      if (rp) {
        setBio(rp.bio ?? null)
        setPreferredGenres(
          Array.isArray(rp.preferred_genres) ? rp.preferred_genres : []
        )
        setGrade(rp.grade ?? null)
        setTotalReviews(rp.total_reviews ?? 0)
        setIsPublic(rp.is_public !== false) // null이면 공개로 간주
      }

      // 팔로워 수 조회
      const { count: fCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', reviewerId)

      setFollowerCount(fCount ?? 0)

      // 공개 리뷰 목록 조회
      const { data: reviewData } = await supabase
        .from('public_reviews')
        .select(`
          id, title, content, rating, like_count, comment_count, created_at,
          campaigns (id, title, author, genre)
        `)
        .eq('reviewer_id', reviewerId)
        .order('created_at', { ascending: false })

      setReviews((reviewData ?? []) as PublicReview[])

      // 로그인 유저의 팔로우 여부 확인
      if (user) {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', reviewerId)
          .maybeSingle()

        setIsFollowing(!!followData)
      }

      setLoading(false)
    }

    init()
  }, [reviewerId])

  // ── 팔로우 토글 처리 ──────────────────────────
  const handleFollow = async () => {
    if (!currentUserId || followLoading) return

    setFollowLoading(true)

    // 낙관적 업데이트
    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setFollowerCount((prev) => prev + (wasFollowing ? -1 : 1))

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('인증 필요')

      const res = await fetch('/api/feed/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reviewerId }),
      })

      // 실패 시 되돌리기
      if (!res.ok) {
        setIsFollowing(wasFollowing)
        setFollowerCount((prev) => prev + (wasFollowing ? 1 : -1))
      }
    } catch {
      setIsFollowing(wasFollowing)
      setFollowerCount((prev) => prev + (wasFollowing ? 1 : -1))
    } finally {
      setFollowLoading(false)
    }
  }

  // 로딩 화면
  if (loading) {
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

  // 프로필을 찾을 수 없을 때
  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: colors.background }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px 60px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '32px',
          }}>
            <button
              onClick={() => router.push('/feed')}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '15px', fontWeight: 600, color: colors.text,
                cursor: 'pointer',
              }}
            >
              ‹ 피드
            </button>
            <Logo size="small" />
          </div>
          <div style={{ ...styles.card, padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '16px', color: colors.subText }}>
              프로필을 찾을 수 없습니다
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 표시할 이름 (name 없으면 email 앞부분)
  const displayName = name || email.split('@')[0] || '익명'
  const isMyProfile = currentUserId === reviewerId

  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* 헤더 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '32px',
        }}>
          <button
            onClick={() => router.push('/feed')}
            onMouseEnter={() => setBackHover(true)}
            onMouseLeave={() => setBackHover(false)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '15px', fontWeight: 600,
              color: backHover ? colors.primary : colors.text,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              transition: 'color 0.15s ease',
            }}
          >
            <span style={{ lineHeight: 1 }}>‹</span>
            피드
          </button>
          <Logo size="small" />
        </div>

        {/* 프로필 카드 */}
        <div style={{ ...styles.card, padding: '32px', textAlign: 'center', marginBottom: '24px' }}>

          {/* 프로필 원형 */}
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            background: colors.primary, color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 700,
            margin: '0 auto',
          }}>
            {getInitial(displayName)}
          </div>

          {/* 이름 */}
          <p style={{ margin: '16px 0 0', fontSize: '22px', fontWeight: 700, color: colors.titleText }}>
            {displayName}
          </p>

          {/* 자기소개 */}
          {bio && (
            <p style={{
              margin: '8px 0 0', fontSize: '15px', color: colors.text,
              lineHeight: 1.6, maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto',
            }}>
              {bio}
            </p>
          )}

          {/* 요약 정보: 리뷰 수 / 팔로워 수 / 등급 */}
          <div style={{
            marginTop: '16px',
            display: 'flex', justifyContent: 'center', gap: '32px',
            flexWrap: 'wrap',
          }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.titleText }}>
                {totalReviews}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: colors.subText }}>리뷰</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: colors.titleText }}>
                {followerCount}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: colors.subText }}>팔로워</p>
            </div>
            {grade && GRADE_LABELS[grade] && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.titleText }}>
                  {GRADE_LABELS[grade]}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: colors.subText }}>등급</p>
              </div>
            )}
          </div>

          {/* 선호 장르 태그 */}
          {preferredGenres.length > 0 && (
            <div style={{
              marginTop: '16px',
              display: 'flex', gap: '8px',
              justifyContent: 'center', flexWrap: 'wrap',
            }}>
              {preferredGenres.map((genre, idx) => (
                <span
                  key={idx}
                  style={{
                    background: colors.subBackground,
                    border: `1px solid ${colors.border}`,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    color: colors.text,
                  }}
                >
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* 팔로우 버튼 — 로그인 상태이고 본인 프로필이 아닐 때만 표시 */}
          {currentUserId && !isMyProfile && (
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={handleFollow}
                disabled={followLoading}
                style={{
                  padding: '8px 32px',
                  borderRadius: '20px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: followLoading ? 'not-allowed' : 'pointer',
                  border: isFollowing ? `1px solid ${colors.border}` : 'none',
                  background: isFollowing ? 'none' : colors.primary,
                  color: isFollowing ? colors.text : '#FFFFFF',
                  opacity: followLoading ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
              >
                {isFollowing ? '팔로잉' : '팔로우'}
              </button>
            </div>
          )}
        </div>

        {/* 리뷰 목록 섹션 */}
        <div>
          <h2 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
            {displayName}님의 리뷰
          </h2>

          {/* 비공개 프로필 안내 */}
          {!isPublic ? (
            <div style={{ ...styles.card, padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '15px', color: colors.subText }}>
                이 리뷰어는 프로필을 비공개로 설정했습니다
              </p>
            </div>
          ) : reviews.length === 0 ? (
            // 리뷰 없을 때
            <div style={{ ...styles.card, padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '15px', color: colors.subText }}>
                아직 작성한 리뷰가 없습니다
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reviews.map((review) => {
                const camp = Array.isArray(review.campaigns)
                  ? review.campaigns[0]
                  : review.campaigns
                const metaText = [camp?.author, camp?.genre].filter(Boolean).join(' · ')

                return (
                  <div key={review.id} style={{ ...styles.card, padding: '24px' }}>

                    {/* 원고 정보 박스 */}
                    {camp && (
                      <div style={{
                        background: colors.subBackground,
                        borderRadius: '12px',
                        padding: '14px',
                        marginBottom: '14px',
                      }}>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.titleText }}>
                          {camp.title}
                        </p>
                        {metaText && (
                          <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.subText }}>
                            {metaText}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 리뷰 제목 */}
                    {review.title && (
                      <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 600, color: colors.titleText }}>
                        {review.title}
                      </p>
                    )}

                    {/* 리뷰 내용 — 최대 4줄 말줄임 */}
                    <p style={{
                      margin: 0,
                      fontSize: '14px',
                      color: colors.text,
                      lineHeight: 1.6,
                      display: '-webkit-box' as React.CSSProperties['display'],
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical' as React.CSSProperties['WebkitBoxOrient'],
                      overflow: 'hidden',
                    }}>
                      {review.content}
                    </p>

                    {/* 별점 + 작성일 */}
                    <div style={{
                      marginTop: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '14px', color: '#FBBF24', letterSpacing: '1px' }}>
                        {renderStars(review.rating)}
                      </span>
                      <span style={{ fontSize: '13px', color: colors.subText2 }}>
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
