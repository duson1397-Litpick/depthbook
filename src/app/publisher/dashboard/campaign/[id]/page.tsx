'use client'

// 캠페인 상세 페이지
// 캠페인 정보 확인 + 리뷰어 목록 관리 (승인/거절)
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'
import Input from '@/components/Input'
import Textarea from '@/components/Textarea'
import { ArrowLeftIcon, CloseIcon, CheckIcon } from '@/components/Icons'

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
  deadline: string | null
  expires_at: string | null
  plan_type: string | null
  sample_ratio: number | null
  invite_token: string | null
  epub_storage_path: string | null
  publication_date: string | null
  purchase_url: string | null
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

// 마감일까지 남은 기간을 텍스트로 반환
// 마감 지남: "기간 만료" / 당일: "오늘 마감" / 이후: "남은 기간: N일"
function formatRemainingDays(deadlineStr: string | null): string {
  if (!deadlineStr) return '미정'
  const days = Math.ceil((new Date(deadlineStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return '기간 만료'
  if (days === 0) return '오늘 마감'
  return `남은 기간: ${days}일`
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

  // ── 캠페인 편집 모달 상태 ────────────────────────
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editGenre, setEditGenre] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // ── 삭제 확인 모달 상태 ─────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ── 출간 정보 상태 ──────────────────────────────
  const [editPubDate, setEditPubDate] = useState('')
  const [editPurchaseUrl, setEditPurchaseUrl] = useState('')
  const [pubInfoSaving, setPubInfoSaving] = useState(false)

  // ── 읽고 싶다 수 ──────────────────────────────
  const [wtrCount, setWtrCount] = useState(0)

  // ── 출간 알림 발송 모달 상태 ──────────────────
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifySending, setNotifySending] = useState(false)
  const [notifySent, setNotifySent] = useState<number | null>(null)

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

    // 출간 정보 초기값 설정
    setEditPubDate(campaignData.publication_date ? campaignData.publication_date.slice(0, 10) : '')
    setEditPurchaseUrl(campaignData.purchase_url ?? '')

    // 읽고 싶다 수 조회
    const { count: wtr } = await supabase
      .from('want_to_read')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
    setWtrCount(wtr ?? 0)

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

  // ── 출간 정보 저장 ────────────────────────────
  const handleSavePubInfo = async () => {
    if (!campaign || pubInfoSaving) return
    setPubInfoSaving(true)

    await supabase
      .from('campaigns')
      .update({
        publication_date: editPubDate || null,
        purchase_url:     editPurchaseUrl.trim() || null,
      })
      .eq('id', campaign.id)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) await loadData(user.id)
    setPubInfoSaving(false)
  }

  // ── 출간 알림 발송 ────────────────────────────
  const handleSendNotify = async () => {
    if (notifySending) return
    setNotifySending(true)

    const res = await fetch('/api/publish-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId }),
    })
    const data = await res.json()
    setNotifySent(data.sent ?? 0)
    setNotifySending(false)
  }

  // ── 캠페인 편집 모달 열기 ─────────────────────
  const handleOpenEdit = () => {
    if (!campaign) return
    setEditTitle(campaign.title)
    setEditAuthor(campaign.author ?? '')
    setEditGenre(campaign.genre ?? '')
    setEditDescription(campaign.description ?? '')
    setShowEditModal(true)
  }

  // ── 캠페인 정보 저장 ──────────────────────────
  const handleSaveCampaign = async () => {
    if (!campaign || editSaving) return
    setEditSaving(true)

    const { error } = await supabase
      .from('campaigns')
      .update({
        title:       editTitle.trim() || campaign.title,
        author:      editAuthor.trim() || null,
        genre:       editGenre.trim() || null,
        description: editDescription.trim() || null,
      })
      .eq('id', campaign.id)

    if (!error) {
      // 수정 후 데이터 다시 불러오기
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await loadData(user.id)
    }

    setEditSaving(false)
    setShowEditModal(false)
  }

  // ── 캠페인 삭제 ────────────────────────────────
  const handleDeleteCampaign = async () => {
    if (!campaign || deleting) return
    setDeleting(true)

    // Storage에서 epub 파일 삭제 (있을 때만)
    if (campaign.epub_storage_path) {
      await supabase.storage.from('manuscripts').remove([campaign.epub_storage_path])
    }

    // campaigns 테이블에서 삭제 (CASCADE로 관련 데이터도 삭제됨)
    await supabase.from('campaigns').delete().eq('id', campaign.id)

    router.push('/publisher/dashboard')
  }

  // 캠페인 상태 변경
  // draft → recruiting 전환 시 플랜 기간에 따라 마감일 자동 설정
  const handleStatusChange = async (nextStatus: CampaignStatus) => {
    if (!campaign) return

    const updateData: Record<string, unknown> = { status: nextStatus }

    if (nextStatus === 'recruiting') {
      // plan_type에 '2m'이 포함되면 60일, 아니면 30일
      const duration = campaign.plan_type?.includes('2m') ? 60 : 30
      const deadline = new Date()
      deadline.setDate(deadline.getDate() + duration)
      updateData.deadline = deadline.toISOString()
      updateData.expires_at = deadline.toISOString()
    }

    const { error } = await supabase
      .from('campaigns')
      .update(updateData)
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

  // 리뷰어 승인 — 서버 API 경유 (이메일 발송 포함)
  const handleApprove = async (reviewerRowId: string) => {
    await fetch('/api/approve-reviewer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignReviewerId: reviewerRowId }),
    })

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
    <>
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
            <ArrowLeftIcon size={18} />
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
          {/* 제목 + 상태 뱃지 + 편집 버튼 */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, marginLeft: '12px' }}>
              <span
                style={{
                  background: campaignBadge.background,
                  color: campaignBadge.color,
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {campaignBadge.label}
              </span>
              {/* 편집 버튼 — draft/recruiting 상태일 때만 표시 */}
              {(campaign.status === 'draft' || campaign.status === 'recruiting') && (
                <button
                  onClick={handleOpenEdit}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    fontSize: '14px', color: colors.primary, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  편집
                </button>
              )}
            </div>
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
              리뷰어 {acceptedCount}명
            </span>
            <span style={{
              color: campaign.deadline && new Date(campaign.deadline) < new Date()
                ? colors.danger
                : colors.subText,
            }}>
              {campaign.status === 'draft'
                ? '모집 전'
                : formatRemainingDays(campaign.deadline)}
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
        {/* 출간 정보 섹션 — active 또는 completed 상태일 때만 표시 */}
        {(campaign.status === 'active' || campaign.status === 'completed') && (
          <div style={{ marginTop: '40px' }}>
            <h2
              style={{
                margin: '0 0 16px',
                fontSize: '18px',
                fontWeight: 600,
                color: colors.titleText,
              }}
            >
              출간 정보
            </h2>
            <div style={{ ...styles.card, padding: '24px' }}>
              {/* 출간일 */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.text,
                    marginBottom: '6px',
                  }}
                >
                  출간일
                </label>
                <Input
                  type="date"
                  value={editPubDate}
                  onChange={(e) => setEditPubDate(e.target.value)}
                />
              </div>

              {/* 구매 링크 */}
              <div style={{ marginBottom: '24px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.text,
                    marginBottom: '6px',
                  }}
                >
                  구매 링크
                </label>
                <Input
                  value={editPurchaseUrl}
                  onChange={(e) => setEditPurchaseUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSavePubInfo}
                disabled={pubInfoSaving}
                style={{
                  height: '44px',
                  padding: '0 28px',
                  borderRadius: '10px',
                  background: pubInfoSaving ? colors.subBackground : colors.primary,
                  color: pubInfoSaving ? colors.subText : '#FFFFFF',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: pubInfoSaving ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  marginRight: '12px',
                }}
              >
                {pubInfoSaving ? '저장 중...' : '저장하기'}
              </button>

              {/* 출간 알림 발송 버튼 — 읽고 싶다 등록자가 있을 때만 표시 */}
              {wtrCount > 0 && (
                <button
                  onClick={() => { setNotifySent(null); setShowNotifyModal(true) }}
                  style={{
                    height: '44px',
                    padding: '0 28px',
                    borderRadius: '10px',
                    background: 'none',
                    border: `1px solid ${colors.primary}`,
                    color: colors.primary,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  출간 알림 발송
                </button>
              )}

              {/* 읽고 싶다 등록자 없을 때 안내 */}
              {wtrCount === 0 && (
                <p style={{ margin: '16px 0 0', fontSize: '13px', color: colors.subText2 }}>
                  "읽고 싶다" 등록 독자가 없어 알림 발송 대상이 없습니다
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* 캠페인 편집 모달 */}
    {showEditModal && campaign && (
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
              캠페인 편집
            </p>
            <button
              onClick={() => setShowEditModal(false)}
              style={{ background: 'none', border: 'none', color: colors.subText, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
            >
              <CloseIcon size={18} />
            </button>
          </div>

          {/* 제목 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>제목</label>
            <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="캠페인 제목" />
          </div>

          {/* 저자 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>저자</label>
            <Input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} placeholder="저자명" />
          </div>

          {/* 장르 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>장르</label>
            <Input value={editGenre} onChange={(e) => setEditGenre(e.target.value)} placeholder="장르" />
          </div>

          {/* 소개 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>소개</label>
            <Textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="캠페인 소개를 입력하세요"
              extraStyle={{ height: '100px' }}
            />
          </div>

          {/* epub 파일 안내 */}
          <p style={{ margin: '0 0 24px', fontSize: '13px', color: colors.subText2 }}>
            원고 파일은 변경할 수 없습니다
          </p>

          {/* 저장 버튼 */}
          <button
            onClick={handleSaveCampaign}
            disabled={editSaving}
            style={{
              width: '100%', height: '48px', borderRadius: '12px',
              background: editSaving ? colors.subBackground : colors.primary,
              color: editSaving ? colors.subText : '#FFFFFF',
              border: 'none', fontSize: '15px', fontWeight: 600,
              cursor: editSaving ? 'not-allowed' : 'pointer',
              marginBottom: '16px', transition: 'background 0.15s',
            }}
          >
            {editSaving ? '저장 중...' : '저장하기'}
          </button>

          {/* 삭제 버튼 — draft 상태일 때만 표시 */}
          {campaign.status === 'draft' && (
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => { setShowEditModal(false); setShowDeleteModal(true) }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  fontSize: '14px', color: colors.danger, cursor: 'pointer',
                }}
              >
                캠페인 삭제
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    {/* 출간 알림 발송 확인 모달 */}
    {showNotifyModal && (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) setShowNotifyModal(false) }}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div style={{
          width: '100%', maxWidth: '400px',
          ...styles.card, padding: '32px',
          boxSizing: 'border-box', textAlign: 'center',
        }}>
          {notifySent === null ? (
            // 발송 전 — 확인 화면
            <>
              <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
                출간 알림 발송
              </p>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: colors.subText, lineHeight: 1.6 }}>
                "읽고 싶다" 등록 독자{' '}
                <span style={{ fontWeight: 600, color: colors.titleText }}>{wtrCount}명</span>
                에게 출간 알림을 보냅니다.
              </p>
              <p style={{ margin: '0 0 24px', fontSize: '13px', color: colors.subText2, lineHeight: 1.5 }}>
                출간일과 구매 링크가 저장되어 있어야 합니다
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowNotifyModal(false)}
                  style={{
                    flex: 1, height: '44px', borderRadius: '10px',
                    background: 'none', border: `1px solid ${colors.border}`,
                    fontSize: '15px', fontWeight: 500, color: colors.text, cursor: 'pointer',
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleSendNotify}
                  disabled={notifySending}
                  style={{
                    flex: 1, height: '44px', borderRadius: '10px',
                    background: notifySending ? colors.subBackground : colors.primary,
                    border: 'none', fontSize: '15px', fontWeight: 600,
                    color: notifySending ? colors.subText : '#FFFFFF',
                    cursor: notifySending ? 'not-allowed' : 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  {notifySending ? '발송 중...' : '발송하기'}
                </button>
              </div>
            </>
          ) : (
            // 발송 완료 화면
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <CheckIcon size={32} color={colors.success} />
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
                발송 완료
              </p>
              <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.subText }}>
                {notifySent}명에게 출간 알림을 보냈습니다
              </p>
              <button
                onClick={() => setShowNotifyModal(false)}
                style={{
                  width: '100%', height: '44px', borderRadius: '10px',
                  background: colors.primary, border: 'none',
                  fontSize: '15px', fontWeight: 600, color: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                확인
              </button>
            </>
          )}
        </div>
      </div>
    )}

    {/* 삭제 확인 모달 */}
    {showDeleteModal && (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false) }}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div style={{
          width: '100%', maxWidth: '400px',
          ...styles.card, padding: '32px',
          boxSizing: 'border-box', textAlign: 'center',
        }}>
          <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
            캠페인을 삭제하시겠습니까?
          </p>
          <p style={{ margin: '0 0 24px', fontSize: '14px', color: colors.subText, lineHeight: 1.6 }}>
            이 작업은 되돌릴 수 없습니다.
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowDeleteModal(false)}
              style={{
                flex: 1, height: '44px', borderRadius: '10px',
                background: 'none', border: `1px solid ${colors.border}`,
                fontSize: '15px', fontWeight: 500, color: colors.text, cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={handleDeleteCampaign}
              disabled={deleting}
              style={{
                flex: 1, height: '44px', borderRadius: '10px',
                background: deleting ? colors.subBackground : colors.danger,
                border: 'none', fontSize: '15px', fontWeight: 600,
                color: deleting ? colors.subText : '#FFFFFF',
                cursor: deleting ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
