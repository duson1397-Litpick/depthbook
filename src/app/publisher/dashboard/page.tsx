'use client'

// 출판사 대시보드 - 캠페인 목록 페이지
// 로그인한 출판사의 캠페인을 조회하고 관리하는 메인 화면
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import { PLANS, formatPrice } from '@/lib/plans'
import Logo from '@/components/Logo'
import Input from '@/components/Input'

// 캠페인 상태 종류
type CampaignStatus = 'draft' | 'recruiting' | 'active' | 'completed'

// 캠페인 데이터 형태
interface Campaign {
  id: string
  title: string
  genre: string | null
  status: CampaignStatus
  max_reviewers: number
  deadline: string | null
  created_at: string
}

// 캠페인 + 리뷰어 수를 합친 형태
interface CampaignWithCount extends Campaign {
  reviewerCount: number
}

// 상태별 뱃지 설정
const STATUS_BADGE: Record<CampaignStatus, { background: string; color: string; label: string }> = {
  draft:     { background: '#F1F5F9', color: colors.subText,  label: '임시저장' },
  recruiting:{ background: '#EEF2FF', color: colors.info,     label: '모집 중'  },
  active:    { background: '#F0FDF4', color: colors.success,  label: '진행 중'  },
  completed: { background: '#F8FAFC', color: colors.subText2, label: '완료'     },
}

// YYYY.MM.DD 형식으로 날짜 변환
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd}`
}

export default function PublisherDashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  // 인증 확인 중 여부
  const [authChecking, setAuthChecking] = useState(true)

  // 출판사 이름 (없으면 이메일로 대체)
  const [displayName, setDisplayName] = useState('')

  // 캠페인 목록 (리뷰어 수 포함)
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])

  // 캠페인 불러오는 중 여부
  const [campaignsLoading, setCampaignsLoading] = useState(true)

  // 로그아웃 버튼 호버 상태
  const [logoutHover, setLogoutHover] = useState(false)

  // 새 캠페인 버튼 호버 상태
  const [newBtnHover, setNewBtnHover] = useState(false)

  // 카드 호버 중인 캠페인 id
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  // 결제 이력 목록
  const [payments, setPayments] = useState<any[]>([])

  // 현재 로그인한 유저 id (편집 저장 시 사용)
  const [userId, setUserId] = useState('')

  // ── 출판사 프로필 편집 모달 상태 ────────────────
  const [showEditModal, setShowEditModal] = useState(false)
  const [editCompanyName, setEditCompanyName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editBusinessNumber, setEditBusinessNumber] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  // 원본 출판사 데이터 보관 (모달 열 때 미리 채움용)
  const [publisherPhone, setPublisherPhone] = useState('')
  const [publisherWebsite, setPublisherWebsite] = useState('')
  const [publisherBusinessNumber, setPublisherBusinessNumber] = useState('')

  useEffect(() => {
    const init = async () => {
      // 로그인 상태 확인
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/publisher/login')
        return
      }

      setAuthChecking(false)
      setUserId(user.id)

      // 출판사 정보 가져오기 (이름 + 연락처 등)
      const { data: publisher } = await supabase
        .from('publishers')
        .select('company_name, contact_phone, website, business_number')
        .eq('id', user.id)
        .single()

      setDisplayName(publisher?.company_name || user.email || '')
      setPublisherPhone(publisher?.contact_phone ?? '')
      setPublisherWebsite(publisher?.website ?? '')
      setPublisherBusinessNumber(publisher?.business_number ?? '')

      // 캠페인 목록 가져오기
      const { data: campaignList } = await supabase
        .from('campaigns')
        .select('*')
        .eq('publisher_id', user.id)
        .order('created_at', { ascending: false })

      if (!campaignList || campaignList.length === 0) {
        setCampaigns([])
        setCampaignsLoading(false)
        return
      }

      // 각 캠페인의 리뷰어 수를 병렬로 조회
      const withCounts = await Promise.all(
        campaignList.map(async (campaign) => {
          const { count } = await supabase
            .from('campaign_reviewers')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaign.id)
            .in('status', ['accepted', 'reading', 'completed'])

          return { ...campaign, reviewerCount: count ?? 0 } as CampaignWithCount
        })
      )

      setCampaigns(withCounts)
      setCampaignsLoading(false)

      // 결제 이력 조회
      const { data: paymentList } = await supabase
        .from('payments')
        .select('*, campaigns(title)')
        .eq('publisher_id', user.id)
        .order('created_at', { ascending: false })

      setPayments(paymentList ?? [])
    }

    init()
  }, [])

  // 출판사 프로필 편집 모달 열기
  const handleOpenEdit = () => {
    setEditCompanyName(displayName)
    setEditPhone(publisherPhone)
    setEditWebsite(publisherWebsite)
    setEditBusinessNumber(publisherBusinessNumber)
    setShowEditModal(true)
  }

  // 출판사 프로필 저장
  const handleSavePublisher = async () => {
    if (!userId || editSaving) return
    setEditSaving(true)

    await supabase
      .from('publishers')
      .update({
        company_name:     editCompanyName.trim() || displayName,
        contact_phone:    editPhone.trim() || null,
        website:          editWebsite.trim() || null,
        business_number:  editBusinessNumber.trim() || null,
      })
      .eq('id', userId)

    // 로컬 상태 반영
    setDisplayName(editCompanyName.trim() || displayName)
    setPublisherPhone(editPhone.trim())
    setPublisherWebsite(editWebsite.trim())
    setPublisherBusinessNumber(editBusinessNumber.trim())

    setEditSaving(false)
    setShowEditModal(false)
  }

  // 로그아웃 처리
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/publisher/login')
  }

  // 인증 확인 중 로딩 화면
  if (authChecking) {
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

  return (
    <>
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
      }}
    >
      {/* 콘텐츠 영역 */}
      <div
        style={{
          maxWidth: styles.maxWidth,
          margin: '0 auto',
          padding: '32px 20px',
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
          <Logo size="small" />
          <button
            onClick={handleLogout}
            onMouseEnter={() => setLogoutHover(true)}
            onMouseLeave={() => setLogoutHover(false)}
            style={{
              background: 'none',
              border: 'none',
              color: logoutHover ? colors.text : colors.subText,
              fontSize: '14px',
              cursor: 'pointer',
              padding: '4px 0',
              transition: 'color 0.15s',
            }}
          >
            로그아웃
          </button>
        </div>

        {/* 환영 문구 */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: 700,
                color: colors.titleText,
              }}
            >
              안녕하세요, {displayName}님
            </h1>
            <button
              onClick={handleOpenEdit}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '14px', color: colors.primary, cursor: 'pointer',
              }}
            >
              편집
            </button>
          </div>
          <p
            style={{
              margin: '8px 0 0',
              fontSize: '15px',
              color: colors.subText,
            }}
          >
            캠페인을 만들어 독자 반응을 수집하세요
          </p>
        </div>

        {/* 새 캠페인 만들기 버튼 */}
        <button
          onClick={() => router.push('/publisher/dashboard/campaign/new')}
          onMouseEnter={() => setNewBtnHover(true)}
          onMouseLeave={() => setNewBtnHover(false)}
          style={{
            width: '100%',
            height: styles.button.height,
            borderRadius: styles.button.borderRadius,
            background: colors.primary,
            color: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            transform: newBtnHover ? 'translateY(-1px)' : 'translateY(0)',
            boxShadow: newBtnHover
              ? '0 4px 14px rgba(29,53,87,0.25)'
              : '0 2px 6px rgba(29,53,87,0.12)',
            transition: 'transform 0.15s, box-shadow 0.15s',
            marginBottom: '24px',
          }}
        >
          + 새 캠페인 만들기
        </button>

        {/* 캠페인 목록 */}
        {campaignsLoading ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: colors.subText,
              fontSize: '15px',
            }}
          >
            불러오는 중...
          </div>
        ) : campaigns.length === 0 ? (
          // 캠페인이 없을 때 안내 카드
          <div
            style={{
              ...styles.card,
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '16px',
                color: colors.subText,
              }}
            >
              아직 캠페인이 없습니다
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '14px',
                color: colors.subText2,
              }}
            >
              첫 캠페인을 만들어 독자의 반응을 확인해보세요
            </p>
          </div>
        ) : (
          // 캠페인 카드 목록
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {campaigns.map((campaign) => {
              const badge = STATUS_BADGE[campaign.status] ?? STATUS_BADGE.draft

              return (
                <div
                  key={campaign.id}
                  onClick={() => router.push(`/publisher/dashboard/campaign/${campaign.id}`)}
                  onMouseEnter={() => setHoveredCard(campaign.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  style={{
                    ...styles.card,
                    padding: '24px',
                    cursor: 'pointer',
                    boxShadow: hoveredCard === campaign.id
                      ? '0 8px 24px rgba(0,0,0,0.08)'
                      : styles.card.boxShadow,
                    transform: hoveredCard === campaign.id ? 'translateY(-2px)' : 'translateY(0)',
                    transition: 'box-shadow 0.2s, transform 0.15s',
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
                    <span
                      style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: colors.titleText,
                      }}
                    >
                      {campaign.title}
                    </span>
                    <span
                      style={{
                        background: badge.background,
                        color: badge.color,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        marginLeft: '12px',
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* 장르 */}
                  {campaign.genre && (
                    <div
                      style={{
                        marginTop: '12px',
                        fontSize: '14px',
                        color: colors.subText,
                      }}
                    >
                      {campaign.genre}
                    </div>
                  )}

                  {/* 리뷰어 수 + 마감일 */}
                  <div
                    style={{
                      marginTop: '12px',
                      display: 'flex',
                      gap: '20px',
                      fontSize: '14px',
                      color: colors.subText,
                    }}
                  >
                    <span>
                      리뷰어 {campaign.reviewerCount}/{campaign.max_reviewers}명
                    </span>
                    <span>
                      마감 {campaign.deadline ? formatDate(campaign.deadline) : '미정'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 결제 이력 섹션 */}
        <div style={{ marginTop: '40px' }}>
          <h2 style={{
            margin: '0 0 16px', fontSize: '18px', fontWeight: 600,
            color: colors.titleText,
          }}>
            결제 이력
          </h2>

          {payments.length === 0 ? (
            <div style={{ ...styles.card, padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '14px', color: colors.subText }}>
                결제 이력이 없습니다
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {payments.map((pay) => {
                const planName = pay.plan_type && PLANS[pay.plan_type as keyof typeof PLANS]
                  ? PLANS[pay.plan_type as keyof typeof PLANS].name
                  : pay.plan_type
                // campaigns가 배열로 올 수도 있어서 첫 번째 항목 사용
                const campaignTitle = Array.isArray(pay.campaigns)
                  ? pay.campaigns[0]?.title ?? '—'
                  : pay.campaigns?.title ?? '—'

                return (
                  <div key={pay.id} style={{
                    ...styles.card, padding: '20px',
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', gap: '12px',
                  }}>
                    {/* 왼쪽: 플랜 + 캠페인 이름 */}
                    <div>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: colors.titleText }}>
                        {planName}
                      </p>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.subText }}>
                        {campaignTitle}
                      </p>
                    </div>

                    {/* 오른쪽: 금액 + 상태 + 날짜 */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: colors.titleText }}>
                        {formatPrice(pay.amount)}
                      </p>
                      <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '12px', fontWeight: 500,
                          background: '#F0FDF4', color: colors.success,
                          padding: '2px 8px', borderRadius: '10px',
                        }}>
                          결제 완료
                        </span>
                        <span style={{ fontSize: '13px', color: colors.subText2 }}>
                          {formatDate(pay.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* 출판사 프로필 편집 모달 */}
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
        }}>
          {/* 모달 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
              프로필 편집
            </p>
            <button
              onClick={() => setShowEditModal(false)}
              style={{ background: 'none', border: 'none', fontSize: '18px', color: colors.subText, cursor: 'pointer', padding: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* 출판사명 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>
              출판사명
            </label>
            <Input value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} placeholder="출판사명" />
          </div>

          {/* 연락처 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>
              연락처
            </label>
            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="연락처" />
          </div>

          {/* 웹사이트 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>
              웹사이트
            </label>
            <Input value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} placeholder="https://" />
          </div>

          {/* 사업자등록번호 */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: colors.text, marginBottom: '6px' }}>
              사업자등록번호
            </label>
            <Input value={editBusinessNumber} onChange={(e) => setEditBusinessNumber(e.target.value)} placeholder="000-00-00000" />
          </div>

          {/* 저장 버튼 */}
          <button
            onClick={handleSavePublisher}
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
