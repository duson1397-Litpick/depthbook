'use client'

// 리뷰어 공개 프로필 페이지
// 누구나 열람 가능. 리뷰 목록, 팔로워 수, 등급 표시.
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'
import Input from '@/components/Input'
import Textarea from '@/components/Textarea'
import { StarIcon, ArrowLeftIcon, CloseIcon } from '@/components/Icons'

// 선호 장르 선택 목록
const GENRE_OPTIONS = ['소설', '에세이', '인문', '자기계발', '경영', '과학', '시', '기타']

// 등급별 표시 텍스트 (이모지 제거)
const GRADE_LABELS: Record<string, string> = {
  bronze:   '브론즈',
  silver:   '실버',
  gold:     '골드',
  platinum: '플래티넘',
}

// 별점을 StarIcon 배열로 렌더링
function RenderStars({ rating }: { rating: number }) {
  const full = Math.round(rating)
  return (
    <span style={{ display: 'inline-flex', gap: '1px' }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <StarIcon key={s} size={14} filled={s <= full} color="#FBBF24" />
      ))}
    </span>
  )
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

  // ── 프로필 편집 모달 상태 ────────────────────────
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editGenres, setEditGenres] = useState<string[]>([])
  const [editIsPublic, setEditIsPublic] = useState(true)
  const [editSaving, setEditSaving] = useState(false)

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

      // Supabase join 결과에서 campaigns가 배열로 오므로 첫 번째 항목만 사용
      const mapped: PublicReview[] = (reviewData ?? []).map((r: any) => ({
        id: r.id,
        title: r.title ?? null,
        content: r.content,
        rating: r.rating,
        like_count: r.like_count ?? 0,
        comment_count: r.comment_count ?? 0,
        created_at: r.created_at,
        campaigns: Array.isArray(r.campaigns)
          ? (r.campaigns[0] ?? null)
          : (r.campaigns ?? null),
      }))
      setReviews(mapped)

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

  // ── 프로필 편집 모달 열기 ─────────────────────
  const handleOpenEdit = () => {
    setEditName(name)
    setEditBio(bio ?? '')
    setEditGenres([...preferredGenres])
    setEditIsPublic(isPublic)
    setShowEditModal(true)
  }

  // ── 프로필 저장 ────────────────────────────────
  const handleSaveProfile = async () => {
    if (!currentUserId || editSaving) return
    setEditSaving(true)

    const trimmedName = editName.trim()

    // profiles 테이블 이름 업데이트
    await supabase
      .from('profiles')
      .update({ name: trimmedName || name })
      .eq('id', currentUserId)

    // reviewer_profiles 테이블 업데이트 (없으면 생성)
    await supabase
      .from('reviewer_profiles')
      .upsert({
        id: currentUserId,
        bio: editBio.trim() || null,
        preferred_genres: editGenres,
        is_public: editIsPublic,
      }, { onConflict: 'id' })

    // 로컬 상태에 즉시 반영
    if (trimmedName) setName(trimmedName)
    setBio(editBio.trim() || null)
    setPreferredGenres(editGenres)
    setIsPublic(editIsPublic)

    setEditSaving(false)
    setShowEditModal(false)
  }

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
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px',
              }}
            >
              <ArrowLeftIcon size={18} />
              피드
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
    <>
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
            <ArrowLeftIcon size={18} />
            피드
          </button>
          <Logo size="small" />
        </div>

        {/* 프로필 카드 */}
        <div style={{ ...styles.card, padding: '32px', textAlign: 'center', marginBottom: '24px', position: 'relative' }}>

          {/* 편집 버튼 — 본인 프로필일 때만 표시 */}
          {isMyProfile && (
            <button
              onClick={handleOpenEdit}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'none', border: 'none', padding: 0,
                fontSize: '14px', color: colors.primary, cursor: 'pointer',
              }}
            >
              편집
            </button>
          )}

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
                      <RenderStars rating={review.rating} />
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

    {/* 프로필 편집 모달 */}
    {showEditModal && (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false) }}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div style={{
          width: '100%', maxWidth: '480px',
          ...styles.card, padding: '32px',
          boxSizing: 'border-box', position: 'relative',
          maxHeight: '90vh', overflowY: 'auto',
        }}>
          {/* 모달 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
              프로필 편집
            </p>
            <button
              onClick={() => setShowEditModal(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.subText, display: 'flex', alignItems: 'center' }}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {/* 이름 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>
              이름
            </label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="이름을 입력하세요"
            />
          </div>

          {/* 자기소개 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>
              자기소개
            </label>
            <Textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="자기소개를 입력하세요"
              extraStyle={{ height: '100px' }}
            />
          </div>

          {/* 선호 장르 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '8px' }}>
              선호 장르
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {GENRE_OPTIONS.map((genre) => {
                const selected = editGenres.includes(genre)
                return (
                  <button
                    key={genre}
                    onClick={() => setEditGenres(
                      selected
                        ? editGenres.filter((g) => g !== genre)
                        : [...editGenres, genre]
                    )}
                    style={{
                      padding: '6px 14px', borderRadius: '16px', fontSize: '14px',
                      cursor: 'pointer', border: 'none', fontWeight: selected ? 600 : 400,
                      background: selected ? colors.primary : colors.subBackground,
                      color: selected ? '#FFFFFF' : colors.text,
                      transition: 'all 0.15s',
                    }}
                  >
                    {genre}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 프로필 공개 여부 */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '8px' }}>
              프로필 공개 여부
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[true, false].map((val) => (
                <button
                  key={String(val)}
                  onClick={() => setEditIsPublic(val)}
                  style={{
                    padding: '8px 20px', borderRadius: '8px', fontSize: '14px',
                    cursor: 'pointer', border: 'none', fontWeight: 500,
                    background: editIsPublic === val ? colors.primary : colors.subBackground,
                    color: editIsPublic === val ? '#FFFFFF' : colors.text,
                    transition: 'all 0.15s',
                  }}
                >
                  {val ? '공개' : '비공개'}
                </button>
              ))}
            </div>
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSaveProfile}
            disabled={editSaving}
            style={{
              width: '100%', height: '48px', borderRadius: '12px',
              background: editSaving ? colors.subBackground : colors.primary,
              color: editSaving ? colors.subText : '#FFFFFF',
              border: 'none', fontSize: '15px', fontWeight: 600,
              cursor: editSaving ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {editSaving ? '저장 중...' : '저장하기'}
          </button>
        </div>
      </div>
    )}
    </>
  )
}
