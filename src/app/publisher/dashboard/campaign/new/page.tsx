'use client'

// 캠페인 생성 페이지
// 플랜 선택 → 폼 입력 → 결제 확인 → 결제 처리 → 완료
// 오픈 기념 최초 3건은 사업자번호 기준으로 무료 (FREE_CAMPAIGN_LIMIT)
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import { PLANS, formatPrice, FREE_CAMPAIGN_LIMIT, FREE_CAMPAIGN_DURATION, type PlanKey } from '@/lib/plans'
import Logo from '@/components/Logo'

// 모바일 기준 너비
const MOBILE_BP = 768

// 화면 단계
type Phase = 'form' | 'payment' | 'complete'

// epub 파일 최대 크기 (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024

// 플랜 카드 표시 순서
const PLAN_ORDER: PlanKey[] = ['sample_1m', 'sample_2m', 'full_1m', 'full_2m']

// NOTE: campaigns 테이블에 아래 컬럼이 필요합니다.
// Supabase SQL 편집기에서 실행하세요:
//
// ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'full_1m';
// ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;
// ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
//
// NOTE: payments 테이블에 RLS INSERT 정책이 필요합니다:
// CREATE POLICY "payments_insert_own" ON payments
//   FOR INSERT WITH CHECK (publisher_id = auth.uid());

export default function CampaignNewPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase] = useState<Phase>('form')
  const [authChecking, setAuthChecking] = useState(true)
  const [userId, setUserId] = useState<string>('')

  // 원고 정보
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')

  // 파일
  const [epubFile, setEpubFile] = useState<File | null>(null)

  // 캠페인 설정
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('full_1m')
  const [sampleRatio, setSampleRatio] = useState('')

  // 무료 캠페인 현황
  const [freeCampaignsUsed, setFreeCampaignsUsed] = useState(0)
  const [freeCampaignsRemaining, setFreeCampaignsRemaining] = useState(FREE_CAMPAIGN_LIMIT)
  const [freeInfoLoaded, setFreeInfoLoaded] = useState(false)

  // 폼 제출 / 결제 상태
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 모바일 여부
  const [isMobile, setIsMobile] = useState(false)

  // 버튼 호버 상태
  const [backHover, setBackHover] = useState(false)
  const [submitHover, setSubmitHover] = useState(false)
  const [fileSelectHover, setFileSelectHover] = useState(false)
  const [fileChangeHover, setFileChangeHover] = useState(false)
  const [payBtnHover, setPayBtnHover] = useState(false)
  const [payBackHover, setPayBackHover] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BP)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // 로그인 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/publisher/login')
        return
      }
      setUserId(user.id)
      setAuthChecking(false)
    }
    checkAuth()
  }, [])

  // 무료 캠페인 잔여 건수 조회
  useEffect(() => {
    if (!userId) return
    const fetchFreeInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const res = await fetch('/api/free-campaigns', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setFreeCampaignsUsed(data.used)
          setFreeCampaignsRemaining(data.remaining)
        }
      } catch {
        // 조회 실패 시 잔여 없음으로 처리 (유료로 진행)
        setFreeCampaignsRemaining(0)
      }
      setFreeInfoLoaded(true)
    }
    fetchFreeInfo()
  }, [userId])

  // 파일 선택 처리
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg('파일 크기는 50MB 이하만 허용됩니다.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setErrorMsg('')
    setEpubFile(file)
  }

  // 폼 유효성 검사 후 결제 화면으로 이동
  const handleFormNext = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!title.trim()) {
      setErrorMsg('제목을 입력하세요.')
      return
    }
    if (!epubFile) {
      setErrorMsg('원고 파일을 업로드하세요.')
      return
    }
    setPhase('payment')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 결제 처리 및 캠페인 생성
  const handlePayment = async () => {
    setErrorMsg('')
    setLoading(true)

    try {
      // ── 결제 시뮬레이션 ────────────────────────────
      // 실제 토스페이먼츠 연동 시 이 블록을 교체하세요.
      await new Promise((resolve) => setTimeout(resolve, 1500))
      // ───────────────────────────────────────────────

      const isFree = freeCampaignsRemaining > 0
      const planInfo = PLANS[selectedPlan]

      // 무료 캠페인은 2개월 플랜을 선택해도 1개월만 적용
      const effectiveDurationDays = isFree ? FREE_CAMPAIGN_DURATION : planInfo.durationDays
      const amount = isFree ? 0 : planInfo.price

      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const campaignId = crypto.randomUUID()

      const expiresAt = new Date(
        Date.now() + effectiveDurationDays * 24 * 60 * 60 * 1000
      ).toISOString()

      // 1. payments 테이블에 먼저 저장 (campaign_id는 생성 후 업데이트)
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          publisher_id: userId,
          campaign_id: null,
          payment_key: isFree ? `FREE-${Date.now()}` : `SIM-${Date.now()}`,
          order_id: orderId,
          amount,
          plan_type: selectedPlan,
          status: 'completed',
          paid_at: new Date().toISOString(),
        })

      if (paymentError) {
        setErrorMsg(`결제 기록 저장 실패: ${paymentError.message}`)
        setLoading(false)
        return
      }

      // 2. epub 파일 스토리지 업로드
      const filePath = `${userId}/${campaignId}/${epubFile!.name}`
      const { error: uploadError } = await supabase.storage
        .from('manuscripts')
        .upload(filePath, epubFile!)

      if (uploadError) {
        setErrorMsg(`파일 업로드 실패: ${uploadError.message}`)
        setLoading(false)
        return
      }

      // 3. 샘플 비율 계산 (샘플 플랜일 때만)
      const isSample = planInfo.type === 'sample'
      const sampleRatioValue = isSample && sampleRatio
        ? parseFloat(sampleRatio) / 100
        : null

      // 4. campaigns 테이블에 저장
      const { error: insertError } = await supabase
        .from('campaigns')
        .insert({
          id: campaignId,
          publisher_id: userId,
          title: title.trim(),
          author: author.trim(),
          genre: genre.trim(),
          description: description.trim(),
          epub_storage_path: filePath,
          sample_ratio: sampleRatioValue,
          max_reviewers: 9999,
          deadline: null, // 모집 시작 시 자동 설정
          status: 'draft',
          plan_type: selectedPlan,
          is_free: isFree,
          expires_at: expiresAt,
        })

      if (insertError) {
        setErrorMsg(`캠페인 생성 실패: ${insertError.message}`)
        setLoading(false)
        return
      }

      // 5. payments에 campaign_id 업데이트
      await supabase
        .from('payments')
        .update({ campaign_id: campaignId })
        .eq('order_id', orderId)

      setPhase('complete')
    } catch {
      setErrorMsg('알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.')
      setLoading(false)
    }
  }

  // 선택한 플랜이 샘플 계열인지
  const isSamplePlan = PLANS[selectedPlan].type === 'sample'
  // 2개월 플랜 여부
  const is2MonthPlan = selectedPlan === 'sample_2m' || selectedPlan === 'full_2m'

  // 공통 인풋 스타일
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: styles.input.height,
    borderRadius: styles.input.borderRadius,
    border: styles.input.border,
    padding: '0 14px',
    fontSize: '15px',
    color: colors.text,
    background: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: colors.text,
    marginBottom: '6px',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '17px',
    fontWeight: 600,
    color: colors.titleText,
    marginBottom: '16px',
  }

  const dividerStyle: React.CSSProperties = {
    height: '1px',
    background: colors.border,
    margin: '24px 0',
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

  // ════════════════════════════════════════════════
  // 완료 화면
  // ════════════════════════════════════════════════
  if (phase === 'complete') {
    const isFree = freeCampaignsRemaining > 0
    return (
      <div style={{
        minHeight: '100vh', background: colors.background,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
      }}>
        <div style={{
          width: '100%', maxWidth: '480px',
          ...styles.card, padding: '48px', textAlign: 'center',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: colors.success, color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', margin: '0 auto',
          }}>✓</div>
          <p style={{ margin: '20px 0 0', fontSize: '20px', fontWeight: 700, color: colors.titleText }}>
            캠페인이 생성되었습니다
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>
            {isFree
              ? `무료 캠페인이 등록되었습니다 (잔여 ${freeCampaignsRemaining - 1}건)`
              : '결제가 완료되고 캠페인이 등록되었습니다'}
          </p>
          <button
            onClick={() => router.push('/publisher/dashboard')}
            style={{
              width: '100%', height: styles.button.height,
              borderRadius: styles.button.borderRadius,
              background: colors.primary, color: '#FFFFFF',
              border: 'none', fontSize: '15px', fontWeight: 600,
              cursor: 'pointer', marginTop: '32px',
            }}
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // 결제 확인 화면
  // ════════════════════════════════════════════════
  if (phase === 'payment') {
    const isFree = freeCampaignsRemaining > 0
    const planInfo = PLANS[selectedPlan]
    const amount = isFree ? 0 : planInfo.price
    const effectiveDurationDays = isFree ? FREE_CAMPAIGN_DURATION : planInfo.durationDays

    return (
      <div style={{
        minHeight: '100vh', background: colors.background,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px 16px',
      }}>
        <div style={{
          width: '100%', maxWidth: '480px',
          ...styles.card, padding: '32px',
        }}>
          {/* 로고 */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <Logo size="medium" />
          </div>

          <p style={{
            margin: '0 0 24px', fontSize: '22px', fontWeight: 700,
            color: colors.titleText, textAlign: 'center',
          }}>
            {isFree ? '무료 캠페인 확인' : '결제 확인'}
          </p>

          {/* 주문 정보 박스 */}
          <div style={{
            background: colors.subBackground, borderRadius: '12px', padding: '20px',
            marginBottom: '24px',
          }}>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.titleText }}>
              {title.trim()}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: colors.subText }}>
              {planInfo.name}
              {isFree && is2MonthPlan && ' → 1개월 적용'}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.subText }}>
              게시 기간: {effectiveDurationDays}일
            </p>

            <div style={{ height: '1px', background: colors.border, margin: '16px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: colors.subText }}>결제 금액</span>
              <div style={{ textAlign: 'right' }}>
                {isFree && (
                  <span style={{
                    fontSize: '14px', color: colors.subText,
                    textDecoration: 'line-through', marginRight: '8px',
                  }}>
                    {formatPrice(planInfo.price)}
                  </span>
                )}
                <span style={{ fontSize: '24px', fontWeight: 700, color: isFree ? colors.success : colors.titleText }}>
                  {isFree ? '무료' : formatPrice(amount)}
                </span>
              </div>
            </div>
          </div>

          {/* 무료 안내 문구 */}
          {isFree && (
            <div style={{
              background: '#EEF2FF', borderRadius: '10px', padding: '12px 16px',
              marginBottom: '16px', fontSize: '13px', color: '#4B5EAA', lineHeight: 1.5,
            }}>
              🎉 오픈 기념 무료 캠페인 {freeCampaignsUsed + 1}/{FREE_CAMPAIGN_LIMIT}건
              {freeCampaignsRemaining === 1 && ' — 마지막 무료 건입니다'}
            </div>
          )}

          {/* 결제 / 등록 버튼 */}
          <button
            onClick={handlePayment}
            disabled={loading}
            onMouseEnter={() => setPayBtnHover(true)}
            onMouseLeave={() => setPayBtnHover(false)}
            style={{
              width: '100%', height: '48px', borderRadius: '12px',
              background: isFree ? colors.success : colors.primary,
              color: '#FFFFFF', border: 'none',
              fontSize: '16px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : payBtnHover ? 0.9 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? '처리 중...' : isFree ? '무료로 등록하기' : '결제하기'}
          </button>

          {/* 에러 메시지 */}
          {errorMsg && (
            <p style={{
              margin: '12px 0 0', fontSize: '14px', color: colors.danger,
              background: '#FEF2F2', border: `1px solid ${colors.danger}`,
              padding: '10px 12px', borderRadius: '8px',
            }}>
              {errorMsg}
            </p>
          )}

          {/* 뒤로가기 */}
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <button
              onClick={() => { setPhase('form'); setErrorMsg('') }}
              onMouseEnter={() => setPayBackHover(true)}
              onMouseLeave={() => setPayBackHover(false)}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '15px', fontWeight: 600,
                color: payBackHover ? colors.primary : colors.text,
                cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', gap: '6px', transition: 'color 0.15s ease',
              }}
            >
              <span style={{ lineHeight: 1 }}>‹</span>
              뒤로 가기
            </button>
          </div>

          {/* 테스트 모드 안내 (유료일 때만) */}
          {!isFree && (
            <p style={{
              margin: '20px 0 0', fontSize: '13px', color: colors.subText2,
              textAlign: 'center', lineHeight: 1.5,
            }}>
              현재는 테스트 모드입니다.<br />실제 결제가 발생하지 않습니다.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // 폼 입력 화면
  // ════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: isMobile ? '24px 16px 60px' : '32px 20px 60px' }}>

        {/* 헤더 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '32px',
        }}>
          <button
            onClick={() => router.push('/publisher/dashboard')}
            onMouseEnter={() => setBackHover(true)}
            onMouseLeave={() => setBackHover(false)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: '15px', fontWeight: 600,
              color: backHover ? colors.primary : colors.text,
              cursor: 'pointer', display: 'inline-flex',
              alignItems: 'center', gap: '6px', transition: 'color 0.15s ease',
            }}
          >
            <span style={{ lineHeight: 1 }}>‹</span>
            뒤로
          </button>
          <Logo size="small" />
        </div>

        {/* 페이지 제목 */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: colors.titleText }}>
            새 캠페인 만들기
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>
            플랜을 선택하고 원고 정보를 입력하세요
          </p>
        </div>

        {/* 오픈 기념 무료 배너 */}
        {freeInfoLoaded && freeCampaignsRemaining > 0 && (
          <div style={{
            background: '#EEF2FF',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}>
            <span style={{ fontSize: '20px' }}>🎉</span>
            <div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#3B4FCA' }}>
                오픈 기념 — 첫 {FREE_CAMPAIGN_LIMIT}건 무료
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#4B5EAA' }}>
                잔여 {freeCampaignsRemaining}건 · 무료 캠페인은 1개월 게시 기간이 적용됩니다
              </p>
            </div>
          </div>
        )}

        {/* 플랜 선택 카드 — 2열 그리드 (모바일 1열) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: '12px',
          marginBottom: '24px',
        }}>
          {PLAN_ORDER.map((key) => {
            const p = PLANS[key]
            const isSelected = selectedPlan === key
            const isFreeAvailable = freeInfoLoaded && freeCampaignsRemaining > 0
            const is2m = key === 'sample_2m' || key === 'full_2m'

            // 무료 잔여가 있을 때 2개월 카드는 비활성화
            const isDisabled = isFreeAvailable && is2m

            return (
              <div
                key={key}
                onClick={() => { if (!isDisabled) setSelectedPlan(key) }}
                style={{
                  ...styles.card,
                  padding: '16px',
                  border: isSelected ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  boxSizing: 'border-box',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.5 : 1,
                  transition: 'border-color 0.15s, opacity 0.15s',
                  position: 'relative',
                }}
              >
                {/* 플랜 이름 */}
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: colors.titleText }}>
                  {p.name}
                </p>
                {/* 설명 */}
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.subText }}>
                  {p.description}
                </p>
                {/* 가격 */}
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  {isFreeAvailable ? (
                    <>
                      <span style={{ fontSize: '16px', fontWeight: 700, color: colors.success }}>무료</span>
                      <span style={{ fontSize: '12px', color: colors.subText, textDecoration: 'line-through' }}>
                        {p.priceLabel}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '16px', fontWeight: 700, color: colors.primary }}>
                      {p.priceLabel}
                    </span>
                  )}
                </div>
                {/* 2개월 카드 비활성화 안내 — 무료 잔여 있을 때 항상 표시 */}
                {isDisabled && (
                  <p style={{
                    margin: '8px 0 0', fontSize: '13px', color: colors.subText2,
                  }}>
                    무료 캠페인은 1개월 게시만 가능합니다
                  </p>
                )}
                {/* 선택 표시 — 비활성화 카드는 표시 안 함 */}
                {isSelected && !isDisabled && (
                  <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: colors.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 700 }}>✓</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 폼 카드 */}
        <form onSubmit={handleFormNext}>
          <div style={{ ...styles.card, padding: '32px' }}>

            {/* 원고 정보 */}
            <p style={sectionTitleStyle}>원고 정보</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>
                  제목 <span style={{ color: colors.danger }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="원고 제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>저자</label>
                <input
                  type="text"
                  placeholder="저자명"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>장르</label>
                <input
                  type="text"
                  placeholder="예: 소설, 에세이, 인문, 자기계발"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>소개</label>
                <textarea
                  placeholder="원고에 대한 간단한 소개"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    ...inputStyle, height: '100px',
                    padding: '12px 14px', resize: 'vertical', lineHeight: '1.5',
                  }}
                />
              </div>
            </div>

            <div style={dividerStyle} />

            {/* epub 파일 업로드 */}
            <p style={sectionTitleStyle}>원고 파일</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".epub"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div style={{
              border: `2px dashed ${colors.border}`, borderRadius: '12px',
              padding: '40px', textAlign: 'center',
            }}>
              {epubFile ? (
                <div>
                  <p style={{
                    margin: '0 0 12px', fontSize: '14px',
                    color: colors.text, wordBreak: 'break-all',
                  }}>
                    {epubFile.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onMouseEnter={() => setFileChangeHover(true)}
                    onMouseLeave={() => setFileChangeHover(false)}
                    style={{
                      background: 'none', border: 'none', padding: 0,
                      color: fileChangeHover ? colors.primary2 : colors.primary,
                      fontSize: '14px', cursor: 'pointer', textDecoration: 'underline',
                    }}
                  >
                    변경
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ margin: '0 0 16px', fontSize: '15px', color: colors.subText }}>
                    epub 파일을 선택하세요
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onMouseEnter={() => setFileSelectHover(true)}
                    onMouseLeave={() => setFileSelectHover(false)}
                    style={{
                      background: fileSelectHover ? colors.border : colors.subBackground,
                      color: colors.text, border: `1px solid ${colors.border}`,
                      borderRadius: '8px', padding: '10px 24px',
                      fontSize: '14px', cursor: 'pointer', transition: 'background 0.15s',
                    }}
                  >
                    파일 선택
                  </button>
                </div>
              )}
            </div>

            <div style={dividerStyle} />

            {/* 캠페인 설정 */}
            <p style={sectionTitleStyle}>캠페인 설정</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 샘플 비율 — 샘플 플랜일 때만 노출 */}
              {isSamplePlan && (
                <div>
                  <label style={labelStyle}>샘플 비율 (%)</label>
                  <input
                    type="number"
                    placeholder="30"
                    min={1}
                    max={100}
                    value={sampleRatio}
                    onChange={(e) => setSampleRatio(e.target.value)}
                    style={inputStyle}
                  />
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: colors.subText2 }}>
                    앞에서부터 입력한 비율만큼만 리뷰어에게 공개됩니다
                  </p>
                </div>
              )}

              {/* 모집 기간 안내 — 마감일은 모집 시작 시 자동 설정 */}
              <div style={{
                padding: '12px 14px', borderRadius: '8px',
                background: colors.subBackground,
                fontSize: '13px', color: colors.subText, lineHeight: 1.6,
              }}>
                모집 시작 후{' '}
                <strong style={{ color: colors.text }}>
                  {PLANS[selectedPlan].durationDays === 60 ? '2개월(60일)' : '1개월(30일)'}
                </strong>
                {' '}동안 진행됩니다.
                <br />마감일은 <strong style={{ color: colors.text }}>모집 시작하기</strong> 버튼을 누를 때 자동으로 설정됩니다.
              </div>
            </div>
          </div>

          {/* 에러 메시지 */}
          {errorMsg && (
            <div style={{
              marginTop: '16px', padding: '12px', borderRadius: '8px',
              fontSize: '14px', background: '#FEF2F2',
              border: `1px solid ${colors.danger}`, color: colors.danger,
            }}>
              {errorMsg}
            </div>
          )}

          {/* 다음 단계 버튼 */}
          <button
            type="submit"
            onMouseEnter={() => setSubmitHover(true)}
            onMouseLeave={() => setSubmitHover(false)}
            style={{
              width: '100%', height: styles.button.height,
              borderRadius: styles.button.borderRadius,
              background: colors.primary, color: '#FFFFFF',
              fontSize: '16px', fontWeight: 600, border: 'none',
              cursor: 'pointer', opacity: submitHover ? 0.9 : 1,
              transition: 'opacity 0.15s', marginTop: '24px',
            }}
          >
            다음: 확인 →
          </button>
        </form>
      </div>
    </div>
  )
}
