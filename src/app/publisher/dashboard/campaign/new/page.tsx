'use client'

// 캠페인 생성 페이지
// 폼 입력 → 결제 확인 → 결제 처리 → 캠페인 생성 완료
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import { PLANS, formatPrice, type PlanType } from '@/lib/plans'
import Logo from '@/components/Logo'

// 캠페인 유형
type CampaignType = 'full' | 'sample'

// 화면 단계
// form: 폼 입력, payment: 결제 확인, complete: 완료
type Phase = 'form' | 'payment' | 'complete'

// 파일 최대 크기 (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024

// NOTE: payments 테이블에 RLS INSERT 정책이 필요합니다.
// Supabase SQL 편집기에서 아래 정책을 실행하세요:
//
// CREATE POLICY "payments_insert_own" ON payments
//   FOR INSERT WITH CHECK (publisher_id = auth.uid());

export default function CampaignNewPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 화면 단계
  const [phase, setPhase] = useState<Phase>('form')

  // 인증 확인 중 여부
  const [authChecking, setAuthChecking] = useState(true)
  // 현재 로그인한 유저 id
  const [userId, setUserId] = useState<string>('')

  // 원고 정보
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [genre, setGenre] = useState('')
  const [description, setDescription] = useState('')

  // 파일
  const [epubFile, setEpubFile] = useState<File | null>(null)

  // 캠페인 설정
  const [campaignType, setCampaignType] = useState<CampaignType>('full')
  const [sampleRatio, setSampleRatio] = useState('')
  const [maxReviewers, setMaxReviewers] = useState('10')
  const [deadline, setDeadline] = useState('')

  // 폼 제출 / 결제 상태
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 버튼 호버 상태
  const [backHover, setBackHover] = useState(false)
  const [submitHover, setSubmitHover] = useState(false)
  const [fileSelectHover, setFileSelectHover] = useState(false)
  const [fileChangeHover, setFileChangeHover] = useState(false)
  const [payBtnHover, setPayBtnHover] = useState(false)
  const [payBackHover, setPayBackHover] = useState(false)

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

  // 폼 유효성 검사 후 결제 화면으로 전환
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

  // 결제 처리 후 캠페인 생성
  const handlePayment = async () => {
    setErrorMsg('')
    setLoading(true)

    try {
      // ── 결제 시뮬레이션 ───────────────────────────
      // 실제 토스페이먼츠 연동 시 이 블록을 교체하면 됩니다.
      // 토스 위젯 또는 SDK를 여기서 호출하고, 승인 응답을 받아 아래로 이어가세요.
      await new Promise((resolve) => setTimeout(resolve, 1500))
      // ─────────────────────────────────────────────

      const plan: PlanType = campaignType === 'full' ? 'full' : 'sample'
      const planInfo = PLANS[plan]
      const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
      const campaignId = crypto.randomUUID()

      // 1. payments 테이블에 먼저 저장 (캠페인 id는 생성 후 업데이트)
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          publisher_id: userId,
          campaign_id: null,           // 캠페인 생성 후 업데이트
          payment_key: `SIM-${Date.now()}`, // 시뮬레이션 키 (토스 연동 시 실제 키로 교체)
          order_id: orderId,
          amount: planInfo.price,
          plan_type: plan,
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

      // 3. 샘플 비율 계산
      const sampleRatioValue =
        campaignType === 'sample' && sampleRatio
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
          max_reviewers: parseInt(maxReviewers) || 10,
          deadline: deadline || null,
          status: 'draft',
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

  // 라벨 스타일
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 500,
    color: colors.text,
    marginBottom: '6px',
  }

  // 섹션 제목 스타일
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '17px',
    fontWeight: 600,
    color: colors.titleText,
    marginBottom: '16px',
  }

  // 구분선 스타일
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
            결제가 완료되고 캠페인이 등록되었습니다
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
    const plan = PLANS[campaignType === 'full' ? 'full' : 'sample']

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

          {/* 제목 */}
          <p style={{
            margin: '0 0 24px', fontSize: '22px', fontWeight: 700,
            color: colors.titleText, textAlign: 'center',
          }}>
            결제 확인
          </p>

          {/* 주문 정보 박스 */}
          <div style={{
            background: colors.subBackground, borderRadius: '12px', padding: '20px',
            marginBottom: '24px',
          }}>
            {/* 캠페인 제목 */}
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: colors.titleText }}>
              {title.trim()}
            </p>
            {/* 플랜 이름 */}
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: colors.subText }}>
              {plan.name}
            </p>

            {/* 구분선 */}
            <div style={{ height: '1px', background: colors.border, margin: '16px 0' }} />

            {/* 결제 금액 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: colors.subText }}>결제 금액</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: colors.titleText }}>
                {formatPrice(plan.price)}
              </span>
            </div>
          </div>

          {/* 결제하기 버튼 */}
          <button
            onClick={handlePayment}
            disabled={loading}
            onMouseEnter={() => setPayBtnHover(true)}
            onMouseLeave={() => setPayBtnHover(false)}
            style={{
              width: '100%', height: '48px', borderRadius: '12px',
              background: colors.primary, color: '#FFFFFF',
              border: 'none', fontSize: '16px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : payBtnHover ? 0.9 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? '처리 중...' : '결제하기'}
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
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '15px',
                fontWeight: 600,
                color: payBackHover ? colors.primary : colors.text,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.15s ease',
              }}
            >
              <span style={{ lineHeight: 1 }}>‹</span>
              뒤로 가기
            </button>
          </div>

          {/* 테스트 모드 안내 */}
          <p style={{
            margin: '20px 0 0', fontSize: '13px', color: colors.subText2,
            textAlign: 'center', lineHeight: 1.5,
          }}>
            현재는 테스트 모드입니다.<br />실제 결제가 발생하지 않습니다.
          </p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // 폼 입력 화면
  // ════════════════════════════════════════════════
  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 20px 60px' }}>

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
            }}
          >
            <span style={{ lineHeight: 1 }}>‹</span>
            뒤로
          </button>
          <Logo size="small" />
        </div>

        {/* 페이지 제목 */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: colors.titleText }}>
            새 캠페인 만들기
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>
            원고 정보와 캠페인 설정을 입력하세요
          </p>
        </div>

        {/* 플랜 가격 안내 */}
        <div style={{
          display: 'flex', gap: '12px', marginBottom: '24px',
        }}>
          {(['full', 'sample'] as PlanType[]).map((key) => {
            const p = PLANS[key]
            const isSelected = (key === 'full') === (campaignType === 'full')
            return (
              <div key={key} style={{
                flex: 1, ...styles.card, padding: '16px',
                border: isSelected ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                boxSizing: 'border-box',
              }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: colors.titleText }}>
                  {p.name}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.subText }}>
                  {p.description}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '15px', fontWeight: 700, color: colors.primary }}>
                  {p.priceLabel}
                </p>
              </div>
            )
          })}
        </div>

        {/* 폼 카드 */}
        <form onSubmit={handleFormNext}>
          <div style={{ ...styles.card, padding: '32px' }}>

            {/* 원고 정보 섹션 */}
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

            {/* epub 파일 업로드 섹션 */}
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

            {/* 캠페인 설정 섹션 */}
            <p style={sectionTitleStyle}>캠페인 설정</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* 캠페인 유형 */}
              <div>
                <label style={labelStyle}>캠페인 유형</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  {(['full', 'sample'] as CampaignType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCampaignType(type)}
                      style={{
                        flex: 1, height: '44px', borderRadius: '10px',
                        border: campaignType === type
                          ? `2px solid ${colors.primary}`
                          : `1px solid ${colors.border}`,
                        background: campaignType === type ? '#F0F4FF' : '#FFFFFF',
                        color: campaignType === type ? colors.primary : colors.text,
                        fontSize: '14px', cursor: 'pointer',
                        fontWeight: campaignType === type ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {type === 'full' ? `완본 (${PLANS.full.priceLabel})` : `샘플 (${PLANS.sample.priceLabel})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* 샘플 비율 */}
              {campaignType === 'sample' && (
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

              {/* 최대 리뷰어 수 */}
              <div>
                <label style={labelStyle}>최대 리뷰어 수</label>
                <input
                  type="number"
                  placeholder="10"
                  min={1}
                  max={100}
                  value={maxReviewers}
                  onChange={(e) => setMaxReviewers(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* 마감일 */}
              <div>
                <label style={labelStyle}>마감일</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  style={inputStyle}
                />
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

          {/* 다음 단계: 결제 확인으로 */}
          <button
            type="submit"
            onMouseEnter={() => setSubmitHover(true)}
            onMouseLeave={() => setSubmitHover(false)}
            style={{
              width: '100%', height: styles.button.height,
              borderRadius: styles.button.borderRadius,
              background: colors.primary, color: '#FFFFFF',
              fontSize: '16px', fontWeight: 600, border: 'none',
              cursor: 'pointer',
              opacity: submitHover ? 0.9 : 1,
              transition: 'opacity 0.15s',
              marginTop: '24px',
            }}
          >
            다음: 결제 확인 →
          </button>
        </form>
      </div>
    </div>
  )
}
