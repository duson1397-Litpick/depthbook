'use client'

// 캠페인 상세 페이지
// 캠페인 정보 확인 + 리뷰어 목록 관리 (승인/거절)
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

// 캠페인 상태 종류
type CampaignStatus = 'draft' | 'recruiting' | 'active' | 'completed'

// 리뷰어 상태 종류
type ReviewerStatus = 'pending' | 'accepted' | 'rejected' | 'reading' | 'completed'

// 캠페인 데이터 형태
interface Campaign {
  id: string
  publisher_id: string
  title: string
  author: string | null
  genre: string | null
  description: string | null
  status: CampaignStatus
  max_reviewers: number
  deadline: string | null
  sample_ratio: number | null
  invite_token: string | null
}

// 리뷰어 행 데이터 형태
interface ReviewerRow {
  id: string
  reviewer_id: string
  status: ReviewerStatus
  created_at: string
  // profiles join 없이 별도 조회 후 합침
  profile: {
    email: string
    name: string | null
  } | null
}

// 캠페인 상태별 뱃지 설정
const CAMPAIGN_BADGE: Record<CampaignStatus, { background: string; color: string; label: string }> = {
  draft:      { background: '#F1F5F9', color: colors.subText,  label: '임시저장' },
  recruiting: { background: '#EEF2FF', color: colors.info,     label: '모집 중'  },
  active:     { background: '#F0FDF4', color: colors.success,  label: '진행 중'  },
  completed:  { background: '#F8FAFC', color: colors.subText2, label: '완료'     },
}

// 리뷰어 상태별 뱃지 설정
const REVIEWER_BADGE: Record<ReviewerStatus, { background: string; color: string; label: string }> = {
  pending:   { background: '#FEF3C7', color: colors.warning,  label: '대기 중' },
  accepted:  { background: '#EEF2FF', color: colors.info,     label: '승인됨'  },
  rejected:  { background: '#FEF2F2', color: colors.danger,   label: '거절됨'  },
  reading:   { background: '#F0FDF4', color: colors.success,  label: '읽는 중' },
  completed: { background: '#F8FAFC', color: colors.subText2, label: '완료'    },
}

// 현재 상태에서 다음 상태로 넘기는 버튼 설정
const STATUS_NEXT: Partial<Record<CampaignStatus, { label: string; next: CampaignStatus }>> = {
  draft:      { label: '모집 시작하기',  next: 'recruiting' },
  recruiting: { label: '진행 시작하기',  next: 'active'     },
  active:     { label: '캠페인 종료하기', next: 'completed'  },
}

// YYYY.MM.DD 형식으로 날짜 변환
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd}`
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const campaignId = params.id
  const router = useRouter()
  const supabase = createClient()

  // 인증 확인 중 여부
  const [authChecking, setAuthChecking] = useState(true)

  // 캠페인 데이터
  const [campaign, setCampaign] = useState<Campaign | null>(null)

  // 리뷰어 목록
  const [reviewers, setReviewers] = useState<ReviewerRow[]>([])

  // 승인된 리뷰어 수
  const [acceptedCount, setAcceptedCount] = useState(0)

  // 초대 링크 복사 완료 상태
  const [copied, setCopied] = useState(false)

  // 버튼 호버 상태
  const [backHover, setBackHover] = useState(false)
  const [statusBtnHover, setStatusBtnHover] = useState(false)
  const [inviteBtnHover, setInviteBtnHover] = useState(false)
  const [reportBtnHover, setReportBtnHover] = useState(false)

  // 데이터 불러오기
  const loadData = async (userId: string) => {
    // 캠페인 조회
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    // 존재하지 않거나 내 캠페인이 아니면 대시보드로 이동
    if (!campaignData || campaignData.publisher_id !== userId) {
      router.push('/publisher/dashboard')
      return
    }

    setCampaign(campaignData)

    // 1단계: campaign_reviewers만 조회 (join 없음)
    // reviewer_id → reviewer_profiles → profiles 경로라 직접 join 불가
    const { data: reviewerData } = await supabase
      .from('campaign_reviewers')
      .select('id, reviewer_id, status, source, created_at')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })

    const rawRows = reviewerData ?? []

    // 2단계: reviewer_id 목록으로 profiles 별도 조회
    const reviewerIds = rawRows.map((r: any) => r.reviewer_id as string)
    const { data: profileData } = reviewerIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, email, name')
          .in('id', reviewerIds)
      : { data: [] }

    // 3단계: reviewer_id를 기준으로 합치기
    const profileMap: Record<string, { email: string; name: string | null }> = {}
    ;(profileData ?? []).forEach((p: any) => {
      profileMap[p.id] = { email: p.email, name: p.name ?? null }
    })

    const rows: ReviewerRow[] = rawRows.map((r: any) => ({
      id: r.id,
      reviewer_id: r.reviewer_id,
      status: r.status as ReviewerStatus,
      created_at: r.created_at,
      profile: profileMap[r.reviewer_id] ?? null,
    }))

    setReviewers(rows)

    // 승인된 리뷰어 수 계산 (accepted + reading + completed)
    const count = rows.filter((r) =>
      ['accepted', 'reading', 'completed'].includes(r.status)
    ).length
    setAcceptedCount(count)
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/publisher/login')
        return
      }
      setAuthChecking(false)
      await loadData(user.id)
    }
    init()
  }, [campaignId])

  // 캠페인 상태 변경
  const handleStatusChange = async (nextStatus: CampaignStatus) => {
    if (!campaign) return

    const { error } = await supabase
      .from('campaigns')
      .update({ status: nextStatus })
      .eq('id', campaign.id)

    if (!error) {
      // 상태 변경 후 데이터 새로 불러오기
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await loadData(user.id)
    }
  }

  // 초대 링크 복사
  const handleCopyInviteLink = () => {
    if (!campaign?.invite_token) return
    const link = `${window.location.origin}/reviewer/join?invite=${campaign.invite_token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      // 2초 후 텍스트 원래대로 복구
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // 리뷰어 승인
  const handleApprove = async (reviewerRowId: string) => {
    await supabase
      .from('campaign_reviewers')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', reviewerRowId)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadData(user.id)
  }

  // 리뷰어 거절
  const handleReject = async (reviewerRowId: string) => {
    await supabase
      .from('campaign_reviewers')
      .update({ status: 'rejected' })
      .eq('id', reviewerRowId)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadData(user.id)
  }

  // 인증 확인 중 로딩 화면
  if (authChecking || !campaign) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.background,
          color: colors.subText,
          fontSize: '15px',
        }}
      >
        불러오는 중...
      </div>
    )
  }

  const campaignBadge = CAMPAIGN_BADGE[campaign.status] ?? CAMPAIGN_BADGE.draft
  const nextStatusInfo = STATUS_NEXT[campaign.status]

  // 저자/장르 한 줄 표시 텍스트
  const metaText = [campaign.author, campaign.genre].filter(Boolean).join(' · ')

  // 샘플 비율 표시 텍스트
  const typeText = campaign.sample_ratio
    ? `샘플 (${Math.round(campaign.sample_ratio * 100)}%)`
    : '완본'

  // 뒤로가기 버튼 스타일
  const backBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: backHover ? colors.primary : colors.text,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'color 0.15s ease',
  }

  // 공통 액션 버튼 스타일
  const actionBtnBase: React.CSSProperties = {
    height: '44px',
    padding: '0 24px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      <div
        style={{
          maxWidth: styles.maxWidth,
          margin: '0 auto',
          padding: '32px 20px 60px',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px',
          }}
        >
          <button
            onClick={() => router.push('/publisher/dashboard')}
            onMouseEnter={() => setBackHover(true)}
            onMouseLeave={() => setBackHover(false)}
            style={backBtnStyle}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>‹</span>
            대시보드
          </button>
          <Logo size="small" />
        </div>

        {/* 캠페인 정보 카드 */}
        <div
          style={{
            ...styles.card,
            padding: '28px',
            marginBottom: '20px',
          }}
        >
          {/* 제목 + 상태 뱃지 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '22px', fontWeight: 700, color: colors.titleText }}>
              {campaign.title}
            </span>
            <span
              style={{
                background: campaignBadge.background,
                color: campaignBadge.color,
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                marginLeft: '12px',
              }}
            >
              {campaignBadge.label}
            </span>
          </div>

          {/* 저자 · 장르 */}
          {metaText && (
            <p style={{ margin: '12px 0 0', fontSize: '14px', color: colors.subText }}>
              {metaText}
            </p>
          )}

          {/* 소개 */}
          {campaign.description && (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '14px',
                color: colors.text,
                lineHeight: 1.6,
              }}
            >
              {campaign.description}
            </p>
          )}

          {/* 구분선 */}
          <div style={{ height: '1px', background: colors.border, margin: '20px 0' }} />

          {/* 요약 정보 */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              flexWrap: 'wrap',
              fontSize: '14px',
            }}
          >
            <span style={{ color: colors.text }}>
              리뷰어 {acceptedCount}/{campaign.max_reviewers}명
            </span>
            <span style={{ color: colors.subText }}>
              마감 {campaign.deadline ? formatDate(campaign.deadline) : '미정'}
            </span>
            <span style={{ color: colors.subText }}>
              유형: {typeText}
            </span>
          </div>
        </div>

        {/* 동작 버튼 영역 */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            marginBottom: '20px',
          }}
        >
          {/* 상태 변경 버튼 (completed 상태면 표시 안 함) */}
          {nextStatusInfo && (
            <button
              onClick={() => handleStatusChange(nextStatusInfo.next)}
              onMouseEnter={() => setStatusBtnHover(true)}
              onMouseLeave={() => setStatusBtnHover(false)}
              style={{
                ...actionBtnBase,
                background: colors.primary,
                color: '#FFFFFF',
                opacity: statusBtnHover ? 0.9 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {nextStatusInfo.label}
            </button>
          )}

          {/* 초대 링크 복사 (모집 중 또는 진행 중일 때) */}
          {(campaign.status === 'recruiting' || campaign.status === 'active') && (
            <button
              onClick={handleCopyInviteLink}
              onMouseEnter={() => setInviteBtnHover(true)}
              onMouseLeave={() => setInviteBtnHover(false)}
              style={{
                ...actionBtnBase,
                background: inviteBtnHover ? colors.subBackground : 'none',
                border: `1px solid ${colors.border}`,
                color: colors.text,
                transition: 'background 0.15s',
              }}
            >
              {copied ? '복사 완료!' : '초대 링크 복사'}
            </button>
          )}

          {/* 리포트 보기 */}
          <button
            onClick={() => router.push(`/publisher/dashboard/campaign/${campaignId}/report`)}
            onMouseEnter={() => setReportBtnHover(true)}
            onMouseLeave={() => setReportBtnHover(false)}
            style={{
              ...actionBtnBase,
              background: reportBtnHover ? colors.subBackground : 'none',
              border: `1px solid ${colors.border}`,
              color: colors.text,
              transition: 'background 0.15s',
            }}
          >
            리포트 보기
          </button>
        </div>

        {/* 상태별 안내 텍스트 */}
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: colors.subText2 }}>
          {campaign.status === 'draft'      && '모집을 시작하면 리뷰어를 초대할 수 있습니다'}
          {campaign.status === 'recruiting' && '리뷰어 모집 중입니다. 초대 링크를 공유하세요'}
          {campaign.status === 'active'     && '리뷰어가 원고를 읽고 있습니다'}
          {campaign.status === 'completed'  && '캠페인이 종료되었습니다'}
        </p>

        {/* 리뷰어 현황 섹션 */}
        <h2
          style={{
            margin: '0 0 16px',
            fontSize: '18px',
            fontWeight: 600,
            color: colors.titleText,
          }}
        >
          리뷰어 현황
        </h2>

        {reviewers.length === 0 ? (
          // 리뷰어 없을 때
          <div
            style={{
              ...styles.card,
              padding: '40px 20px',
              textAlign: 'center',
              color: colors.subText,
              fontSize: '15px',
            }}
          >
            아직 참여한 리뷰어가 없습니다
          </div>
        ) : (
          // 리뷰어 목록
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reviewers.map((reviewer) => {
              const badge = REVIEWER_BADGE[reviewer.status] ?? REVIEWER_BADGE.pending

              // 이름이 있으면 "이름 (이메일)", 없으면 이메일만
              const { profile } = reviewer
              const displayName = profile?.name
                ? `${profile.name} (${profile.email})`
                : profile?.email ?? reviewer.reviewer_id

              return (
                <div
                  key={reviewer.id}
                  style={{
                    ...styles.card,
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {/* 왼쪽: 이름 + 참여일 */}
                  <div>
                    <p style={{ margin: 0, fontSize: '15px', color: colors.text }}>
                      {displayName}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.subText2 }}>
                      {formatDate(reviewer.created_at)} 참여
                    </p>
                  </div>

                  {/* 오른쪽: 상태 뱃지 + 승인/거절 버튼 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span
                      style={{
                        background: badge.background,
                        color: badge.color,
                        padding: '4px 10px',
                        borderRadius: '16px',
                        fontSize: '13px',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {badge.label}
                    </span>

                    {/* 대기 중일 때만 승인/거절 버튼 표시 */}
                    {reviewer.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(reviewer.id)}
                          style={{
                            background: colors.success,
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '4px 14px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleReject(reviewer.id)}
                          style={{
                            background: 'none',
                            border: `1px solid ${colors.danger}`,
                            color: colors.danger,
                            padding: '4px 14px',
                            borderRadius: '8px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          거절
                        </button>
                      </>
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
