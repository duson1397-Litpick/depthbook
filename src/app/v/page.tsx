'use client'

// 웹뷰어 페이지 v2
// 토큰 링크 접속 → 이메일 인증 → epub 원고 열람 → 설문 제출
// 기능: 하이라이트, 워터마크, 보안, 목차, 북마크, 테마, 스와이프, 진행률 바, 설정 패널, 바 자동 숨김
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'
import { ArrowLeftIcon, ArrowRightIcon, StarIcon, WarningIcon, MenuIcon, HighlightIcon, CloseIcon, CheckIcon } from '@/components/Icons'

// 페이지 단계 (인증 흐름)
type Step = 'loading' | 'invalid' | 'ended' | 'verify-email' | 'viewer'

// 뷰어 안에서의 화면 단계
type Phase = 'viewer' | 'survey' | 'done' | 'publicReview' | 'allDone'

// 테마 종류 (세피아 제거 — 노란 배경에서 글이 잘 안 보여 밝은/어두운만 유지)
type Theme = 'light' | 'dark'

// 하이라이트 항목
interface HighlightItem {
  id: string
  text: string
  cfi_range: string
  chapter_label: string | null
}

// 하이라이트 팝업 위치 + 내용
interface HighlightPopup {
  x: number
  y: number
  cfiRange: string
  text: string
}

// 목차 항목
interface TocItem {
  label: string
  href: string
}

// 테마별 색상 설정 (밝은 / 어두운 두 가지만 유지)
const THEME_CONFIG: Record<Theme, {
  bg: string
  text: string
  barBg: string
  barText: string
  watermark: string
}> = {
  light: {
    bg: '#FFFFFF',
    text: '#333E4F',
    barBg: '#FFFFFF',
    barText: colors.text,
    watermark: 'rgba(0,0,0,0.06)',
  },
  dark: {
    bg: '#1A1A2E',
    text: '#D4D4D8',
    barBg: '#16162A',
    barText: '#D4D4D8',
    watermark: 'rgba(255,255,255,0.06)',
  },
}

// 뒤로가기 버튼 — 설문/리뷰 화면 상단에 공통으로 쓰는 텍스트 버튼
function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        fontSize: '15px',
        fontWeight: 600,
        color: hover ? colors.primary : colors.text,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'color 0.15s ease',
        marginBottom: '24px',
      }}
    >
      <ArrowLeftIcon size={18} />
      {label}
    </button>
  )
}

// 워터마크 격자 위치 생성 (대각선 반복 패턴)
const WATERMARK_POSITIONS: { top: number; left: number }[] = []
for (let row = -1; row < 7; row++) {
  for (let col = -1; col < 5; col++) {
    WATERMARK_POSITIONS.push({ top: row * 200, left: col * 360 })
  }
}

function ViewerPageInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  // ── 공통 상태 ──────────────────────────────────
  const [step, setStep] = useState<Step>('loading')
  const [phase, setPhase] = useState<Phase>('viewer')
  const [campaignTitle, setCampaignTitle] = useState('')
  const [reviewerEmail, setReviewerEmail] = useState('')
  const [debugError, setDebugError] = useState('')

  // ── 이메일 인증 화면 상태 ──────────────────────
  const [errorMsg, setErrorMsg] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyBtnHover, setVerifyBtnHover] = useState(false)

  // ── epub 뷰어 상태 ─────────────────────────────
  const [epubLoading, setEpubLoading] = useState(true)
  const [totalPages, setTotalPages] = useState(0)
  const [progress, setProgress] = useState(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const renditionRef = useRef<any>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const viewerOpenedAtRef = useRef<string>('')

  // ── 열람 기록 수집용 ref ───────────────────────────
  // ref 사용 이유: 이벤트 핸들러(relocated, beforeunload)가 클로저로 캡처하기 때문
  const campaignReviewerIdRef = useRef<string>('')
  const campaignIdRef         = useRef<string>('')
  const tocRef                = useRef<TocItem[]>([])
  const chapterStartTimeRef   = useRef<number>(0)
  const currentChapterRef     = useRef<{ index: number; label: string }>({ index: -1, label: '' })

  // ── 목차 상태 ──────────────────────────────────
  const [showTocPanel, setShowTocPanel] = useState(false)
  const [tocItems, setTocItems] = useState<TocItem[]>([])
  const [currentChapterHref, setCurrentChapterHref] = useState('')
  const [hoveredTocIndex, setHoveredTocIndex] = useState<number | null>(null)

  // ── 북마크 토스트 상태 ─────────────────────────
  const [bookmarkToast, setBookmarkToast] = useState(false)

  // ── 테마 상태 (localStorage에서 복원) ───────────
  const [theme, setTheme] = useState<Theme>('light')

  // ── 설정 패널 상태 ─────────────────────────────
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [fontSize, setFontSize] = useState(100)     // 80~150, 기본 100%
  const [lineHeight, setLineHeight] = useState(1.6) // 1.2~2.2, 기본 1.6
  const [margin, setMargin] = useState(20)          // 0~60px, 기본 20px

  // ── 상단/하단 바 자동 숨김 상태 ────────────────
  const [barsVisible, setBarsVisible] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  // 패널 열림 여부를 ref로 추적 (타이머 콜백에서 최신값 참조용)
  const panelsOpenRef = useRef(false)

  // ── 하이라이트 상태 ────────────────────────────
  const [highlightPopup, setHighlightPopup] = useState<HighlightPopup | null>(null)
  const [highlights, setHighlights] = useState<HighlightItem[]>([])
  const [showHighlightPanel, setShowHighlightPanel] = useState(false)
  const [highlightToast, setHighlightToast] = useState(false)
  // selected 이벤트 직후 click 이벤트가 팝업을 닫지 않도록 잠깐 막는 플래그
  const suppressPopupClearRef = useRef(false)

  // ── 설문 상태 ──────────────────────────────────
  const [surveySubmitted, setSurveySubmitted] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [oneLiner, setOneLiner] = useState('')
  const [goodPoints, setGoodPoints] = useState('')
  const [badPoints, setBadPoints] = useState('')
  const [recommendLevel, setRecommendLevel] = useState<number | null>(null)
  const [targetReader, setTargetReader] = useState<string[]>([])
  const [surveyError, setSurveyError] = useState('')
  const [surveyLoading, setSurveyLoading] = useState(false)
  const [submitBtnHover, setSubmitBtnHover] = useState(false)

  // ── 공개 리뷰 상태 ────────────────────────────
  const [publicReviewSubmitted, setPublicReviewSubmitted] = useState(false)
  const [publicReviewTitle, setPublicReviewTitle] = useState('')
  const [publicReviewContent, setPublicReviewContent] = useState('')
  const [publicReviewRating, setPublicReviewRating] = useState(0)
  const [publicReviewHoverRating, setPublicReviewHoverRating] = useState(0)
  const [publicReviewError, setPublicReviewError] = useState('')
  const [publicReviewLoading, setPublicReviewLoading] = useState(false)

  // ── 샘플 비율 초과 차단 상태 ───────────────────
  // sampleRatioRef: 이벤트 핸들러 안에서 항상 최신값 참조
  const [showSampleLimit, setShowSampleLimit] = useState(false)
  const sampleRatioRef = useRef<number | null>(null)

  // ── 보안 상태 ──────────────────────────────────
  const [showDevToolsWarning, setShowDevToolsWarning] = useState(false)

  // ── 모바일 판별 ────────────────────────────────
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── localStorage에서 설정값 복원 ───────────────
  useEffect(() => {
    // 세피아가 저장돼 있으면 밝은 테마로 초기화
    const savedTheme = localStorage.getItem('depthbook-theme') as Theme | null
    if (savedTheme && ['light', 'dark'].includes(savedTheme)) setTheme(savedTheme)
    const savedFs = localStorage.getItem('depthbook-font-size')
    if (savedFs) setFontSize(Number(savedFs))
    const savedLh = localStorage.getItem('depthbook-line-height')
    if (savedLh) setLineHeight(Number(savedLh))
    const savedMg = localStorage.getItem('depthbook-margin')
    if (savedMg) setMargin(Number(savedMg))
  }, [])

  // ── panelsOpenRef 동기화 (타이머 콜백에서 최신값 참조) ──
  useEffect(() => {
    panelsOpenRef.current = showSettingsPanel || showTocPanel || showHighlightPanel || !!highlightPopup
  }, [showSettingsPanel, showTocPanel, showHighlightPanel, highlightPopup])

  // ── 패널 열릴 때 바 항상 표시 + 타이머 멈춤 ───
  useEffect(() => {
    if (showSettingsPanel || showTocPanel || showHighlightPanel || !!highlightPopup) {
      clearTimeout(hideTimerRef.current)
      setBarsVisible(true)
    }
  }, [showSettingsPanel, showTocPanel, showHighlightPanel, highlightPopup])

  // ── 바 자동 숨기기 타이머 초기화 ───────────────
  // 마우스 움직임/터치/클릭 이벤트에 연결
  const resetHideTimer = () => {
    setBarsVisible(true)
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      // 패널이 열려 있으면 숨기지 않음
      if (!panelsOpenRef.current) setBarsVisible(false)
    }, 3000)
  }

  // ── 뷰어 진입 시 타이머 시작 ───────────────────
  useEffect(() => {
    if (step !== 'viewer' || phase !== 'viewer') return
    resetHideTimer()
    return () => clearTimeout(hideTimerRef.current)
  }, [step, phase])

  // ── 1단계: 토큰 유효성 확인 ────────────────────
  useEffect(() => {
    if (!token) { setStep('invalid'); return }

    const checkToken = async () => {
      const res = await fetch('/api/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()

      if (!res.ok) {
        setDebugError(`HTTP ${res.status} — ${JSON.stringify(data)}`)
        setStep(data.error === '종료된 캠페인입니다' ? 'ended' : 'invalid')
        return
      }

      setCampaignTitle(data.campaignTitle)
      setReviewerEmail(data.reviewerEmail ?? '')
      if (data.campaignReviewerId) campaignReviewerIdRef.current = data.campaignReviewerId
      if (data.campaignId)         campaignIdRef.current         = data.campaignId
      // 샘플 비율 저장 (0~1 소수, null이면 완본)
      sampleRatioRef.current = data.sampleRatio ?? null
      setStep(data.isVerified ? 'viewer' : 'verify-email')
    }

    checkToken()
  }, [token])

  // ── 2단계: epub 로드 + 보안 훅 + 하이라이트 복원 + 설문 상태 확인 ─
  useEffect(() => {
    if (step !== 'viewer') return

    viewerOpenedAtRef.current = new Date().toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })

    const loadEpub = async () => {
      const urlRes = await fetch('/api/epub-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      })
      if (!urlRes.ok) { setStep('invalid'); return }
      const { url: epubUrl } = await urlRes.json()

      // epub 파일을 ArrayBuffer로 통째로 받아서 epub.js에 넘김
      const epubRes = await fetch(epubUrl)
      if (!epubRes.ok) {
        setErrorMsg('원고를 불러올 수 없습니다')
        setStep('invalid')
        return
      }
      const arrayBuffer = await epubRes.arrayBuffer()

      const ePub = (await import('epubjs')).default
      if (!viewerRef.current) return

      const book = ePub(arrayBuffer)
      const rendition = book.renderTo(viewerRef.current, {
        width: '100%', height: '100%', spread: 'none',
      })
      renditionRef.current = rendition

      // 보안 훅: 복사/우클릭/드래그 차단 + 스와이프 터치 등록 (iframe 내부)
      rendition.hooks.content.register((contents: any) => {
        const doc = contents.document
        doc.addEventListener('contextmenu', (e: Event) => e.preventDefault())
        doc.addEventListener('copy', (e: Event) => e.preventDefault())
        doc.addEventListener('dragstart', (e: Event) => e.preventDefault())

        // 모바일 스와이프: iframe 내부 터치 이벤트 등록
        let touchStartX = 0
        doc.addEventListener('touchstart', (e: TouchEvent) => {
          touchStartX = e.changedTouches[0].screenX
        }, { passive: true })
        doc.addEventListener('touchend', (e: TouchEvent) => {
          const diff = touchStartX - e.changedTouches[0].screenX
          if (diff > 50) rendition.next()
          if (diff < -50) rendition.prev()
        }, { passive: true })
      })

      // 텍스트 선택 → 하이라이트 팝업
      rendition.on('selected', (cfiRange: string, contents: any) => {
        const selection = contents.window.getSelection()
        if (!selection || selection.isCollapsed) { setHighlightPopup(null); return }
        const text = selection.toString().trim()
        if (text.length === 0) { setHighlightPopup(null); return }

        // iframe 내부 좌표를 화면 좌표로 변환
        const range = selection.getRangeAt(0)
        const selRect = range.getBoundingClientRect()
        const iframe = viewerRef.current?.querySelector('iframe')
        const iframeRect = iframe?.getBoundingClientRect()
        if (!iframeRect) return

        const x = selRect.width > 0
          ? iframeRect.left + selRect.left + selRect.width / 2
          : iframeRect.left + iframeRect.width / 2
        const y = selRect.height > 0
          ? iframeRect.top + selRect.top
          : iframeRect.top + iframeRect.height * 0.3

        suppressPopupClearRef.current = true
        setTimeout(() => { suppressPopupClearRef.current = false }, 500)
        setHighlightPopup({ x, y, cfiRange, text })
      })

      // epub 콘텐츠 클릭 시 팝업 닫기
      rendition.on('click', () => {
        if (suppressPopupClearRef.current) return
        setHighlightPopup(null)
      })

      book.ready.then(() => {
        book.locations.generate(1024).then(() => {
          setTotalPages(book.locations.length())
          // generate() 완료 후 현재 위치의 진행률을 다시 계산
          // (generate 전에 relocated가 먼저 발생하면 진행률이 0 또는 잘못된 값에 고정되기 때문)
          const loc = renditionRef.current?.currentLocation()
          if (loc?.start?.cfi) {
            const pct = book.locations.percentageFromCfi(loc.start.cfi)
            setProgress(Math.round(pct * 100))
          }
        })
      })

      // 목차 로드 → state와 ref 모두에 저장
      book.loaded.navigation.then((nav: any) => {
        const toc = (nav.toc ?? []).map((item: any) => ({
          label: (item.label ?? '').trim(),
          href:  item.href ?? '',
        }))
        tocRef.current = toc
        setTocItems(toc)
      })

      // 챕터 체류 시간을 API로 전송하는 함수
      const sendDuration = (chapterIndex: number, chapterLabel: string, durationSeconds: number) => {
        if (!campaignReviewerIdRef.current || durationSeconds < 3) return
        const payload = JSON.stringify({
          campaignReviewerId: campaignReviewerIdRef.current,
          campaignId:         campaignIdRef.current,
          chapterIndex,
          chapterLabel,
          durationSeconds,
        })
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/reading-session', new Blob([payload], { type: 'application/json' }))
        } else {
          fetch('/api/reading-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {})
        }
      }

      rendition.on('relocated', (location: any) => {
        // 진행률 + 버튼 상태 업데이트
        if (book.locations.length() > 0) {
          const pct = book.locations.percentageFromCfi(location.start.cfi)
          setProgress(Math.round(pct * 100))

          // 샘플 비율 초과 여부 확인
          // sampleRatioRef가 null이면 완본 플랜이므로 차단 없음
          if (sampleRatioRef.current !== null) {
            if (pct >= sampleRatioRef.current) {
              setShowSampleLimit(true)
            } else {
              setShowSampleLimit(false)
            }
          }
        }
        setAtStart(location.atStart)
        setAtEnd(location.atEnd)

        // 현재 챕터 href 업데이트 (목차 항목 하이라이트용)
        setCurrentChapterHref(location.start.href ?? '')

        // 북마크 자동 저장 (CFI 위치를 localStorage에 기록)
        const cfi = location.start.cfi
        if (cfi && token) {
          localStorage.setItem(`depthbook-bookmark-${token}`, cfi)
        }

        // 챕터 변경 감지 및 체류 시간 기록
        const currentHref = location.start.href ?? ''
        const toc = tocRef.current
        const newIndex = toc.findIndex((item) =>
          currentHref.includes(item.href) || item.href.includes(currentHref)
        )
        const newLabel = newIndex >= 0 ? toc[newIndex].label : `챕터 ${newIndex + 1}`

        const prev = currentChapterRef.current
        const now  = Date.now()

        if (prev.index >= 0 && chapterStartTimeRef.current > 0) {
          const elapsed = Math.floor((now - chapterStartTimeRef.current) / 1000)
          sendDuration(prev.index, prev.label, elapsed)
        }

        currentChapterRef.current = { index: newIndex, label: newLabel }
        chapterStartTimeRef.current = now
      })

      // 뷰어를 떠날 때 현재 챕터 체류 시간 전송
      const handleBeforeUnload = () => {
        const cur = currentChapterRef.current
        if (cur.index < 0 || chapterStartTimeRef.current === 0) return
        const elapsed = Math.floor((Date.now() - chapterStartTimeRef.current) / 1000)
        sendDuration(cur.index, cur.label, elapsed)
        chapterStartTimeRef.current = 0
      }
      window.addEventListener('beforeunload', handleBeforeUnload)
      ;(rendition as any).__handleBeforeUnload = handleBeforeUnload

      // 저장된 북마크 위치 복원
      const savedCfi = token ? localStorage.getItem(`depthbook-bookmark-${token}`) : null
      if (savedCfi) {
        await rendition.display(savedCfi)
        // 북마크 복원 안내 토스트 (2초)
        setBookmarkToast(true)
        setTimeout(() => setBookmarkToast(false), 2000)
      } else {
        await rendition.display()
      }
      setEpubLoading(false)

      // 저장된 테마/폰트/줄간격/여백 적용
      const savedTheme = (localStorage.getItem('depthbook-theme') ?? 'light') as Theme
      const tc = THEME_CONFIG[savedTheme] ?? THEME_CONFIG.light
      rendition.themes.override('color', tc.text)
      rendition.themes.override('background-color', tc.bg)

      const savedFs = localStorage.getItem('depthbook-font-size')
      if (savedFs) rendition.themes.fontSize(`${savedFs}%`)

      const savedLh = localStorage.getItem('depthbook-line-height')
      if (savedLh) rendition.themes.override('line-height', savedLh)

      const savedMg = localStorage.getItem('depthbook-margin')
      if (savedMg) rendition.themes.override('padding', `0 ${savedMg}px`)

      // 기존 하이라이트 복원
      const hlRes = await fetch(`/api/highlights?accessToken=${encodeURIComponent(token)}`)
      if (hlRes.ok) {
        const { highlights: existing } = await hlRes.json()
        setHighlights(existing ?? [])
        ;(existing ?? []).forEach((hl: HighlightItem) => {
          rendition.annotations.highlight(hl.cfi_range, {}, () => {}, 'hl', {
            fill: '#FBBF24', 'fill-opacity': '0.3',
          })
        })
      }

      // 설문 제출 여부 확인
      const surveyRes = await fetch(`/api/survey?accessToken=${encodeURIComponent(token)}`)
      if (surveyRes.ok) {
        const { submitted } = await surveyRes.json()
        setSurveySubmitted(submitted)
      }

      // 공개 리뷰 작성 여부 확인
      const reviewRes = await fetch(`/api/public-review?accessToken=${encodeURIComponent(token)}`)
      if (reviewRes.ok) {
        const { submitted: reviewDone } = await reviewRes.json()
        setPublicReviewSubmitted(reviewDone)
      }
    }

    loadEpub()
    return () => {
      if (renditionRef.current) {
        const fn = (renditionRef.current as any).__handleBeforeUnload
        if (fn) window.removeEventListener('beforeunload', fn)
        renditionRef.current.destroy()
        renditionRef.current = null
      }
    }
  }, [step, token])

  // ── 뷰어 외부 div 스와이프 (iframe 영역 바깥) ──
  useEffect(() => {
    if (step !== 'viewer') return
    const el = viewerRef.current
    if (!el) return

    let touchStartX = 0
    const onTouchStart = (e: TouchEvent) => { touchStartX = e.changedTouches[0].screenX }
    const onTouchEnd = (e: TouchEvent) => {
      const diff = touchStartX - e.changedTouches[0].screenX
      if (diff > 50) renditionRef.current?.next()
      if (diff < -50) renditionRef.current?.prev()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [step])

  // ── 키보드 화살표로 페이지 넘김 ─────────
  useEffect(() => {
    if (step !== 'viewer') return
    const handleArrow = (e: KeyboardEvent) => {
      if (!renditionRef.current) return
      if (e.key === 'ArrowLeft') renditionRef.current.prev()
      if (e.key === 'ArrowRight') renditionRef.current.next()
    }
    window.addEventListener('keydown', handleArrow)
    return () => window.removeEventListener('keydown', handleArrow)
  }, [step])

  // ── 페이지 수준 보안 ────────────────────
  useEffect(() => {
    if (step !== 'viewer') return

    const printStyle = document.createElement('style')
    printStyle.id = 'depthbook-print-block'
    printStyle.textContent = '@media print { body { display: none !important; } }'
    document.head.appendChild(printStyle)

    const blockCtxMenu = (e: Event) => e.preventDefault()
    document.addEventListener('contextmenu', blockCtxMenu)

    const blockKeys = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') e.preventDefault()
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') e.preventDefault()
      if ((e.ctrlKey || e.metaKey) && e.key === 's') e.preventDefault()
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') e.preventDefault()
      if (e.key === 'F12') e.preventDefault()
    }
    document.addEventListener('keydown', blockKeys)

    return () => {
      document.removeEventListener('contextmenu', blockCtxMenu)
      document.removeEventListener('keydown', blockKeys)
      document.getElementById('depthbook-print-block')?.remove()
    }
  }, [step])

  // ── 개발자 도구 감지 ────────────────────
  useEffect(() => {
    if (step !== 'viewer') return
    const interval = setInterval(() => {
      const threshold = 160
      setShowDevToolsWarning(
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      )
    }, 1000)
    return () => clearInterval(interval)
  }, [step])

  // ── 테마 변경 + 렌디션 적용 ────────────────────
  const applyTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem('depthbook-theme', newTheme)
    const tc = THEME_CONFIG[newTheme]
    if (renditionRef.current) {
      renditionRef.current.themes.override('color', tc.text)
      renditionRef.current.themes.override('background-color', tc.bg)
    }
  }

  // ── 글자 크기 변경 + 렌디션 적용 ──────────────
  const applyFontSize = (value: number) => {
    setFontSize(value)
    localStorage.setItem('depthbook-font-size', String(value))
    renditionRef.current?.themes.fontSize(`${value}%`)
  }

  // ── 줄간격 변경 + 렌디션 적용 ─────────────────
  const applyLineHeight = (value: number) => {
    setLineHeight(value)
    localStorage.setItem('depthbook-line-height', String(value))
    renditionRef.current?.themes.override('line-height', String(value))
  }

  // ── 여백 변경 + 렌디션 적용 ───────────────────
  const applyMargin = (value: number) => {
    setMargin(value)
    localStorage.setItem('depthbook-margin', String(value))
    renditionRef.current?.themes.override('padding', `0 ${value}px`)
  }

  // ── 하이라이트 저장 ────────────────────────────
  const handleHighlight = async () => {
    if (!highlightPopup || !renditionRef.current) return
    const { cfiRange } = highlightPopup
    const text = highlightPopup.text.trim()
    if (!text) { setHighlightPopup(null); return }

    try {
      renditionRef.current.annotations.highlight(cfiRange, {}, () => {}, 'hl', {
        fill: '#FBBF24', 'fill-opacity': '0.3',
      })
    } catch (e) {}
    setHighlightPopup(null)

    const chapterLabel = currentChapterRef.current.label || null

    const res = await fetch('/api/highlights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken: token, text, cfiRange, chapterLabel }),
    })

    if (res.ok) {
      const body = await res.json()
      if (body.highlight) {
        setHighlights((prev) => [...prev, body.highlight])
      } else {
        const hlRes = await fetch(`/api/highlights?accessToken=${encodeURIComponent(token)}`)
        if (hlRes.ok) {
          const { highlights: fresh } = await hlRes.json()
          setHighlights(fresh ?? [])
        }
      }
      setHighlightToast(true)
      setTimeout(() => setHighlightToast(false), 2000)
    } else {
      const body = await res.json().catch(() => ({}))
      const detail = [body.error, body.details, body.code, `HTTP ${res.status}`].filter(Boolean).join(' / ')
      alert(`하이라이트 저장에 실패했습니다.\n${detail}`)
    }
  }

  // ── 하이라이트 삭제 ────────────────────────────
  const handleDeleteHighlight = async (highlightId: string, cfiRange: string) => {
    setHighlights((prev) => prev.filter((hl) => hl.id !== highlightId))
    try { renditionRef.current?.annotations.remove(cfiRange, 'highlight') } catch (e) {}
    await fetch('/api/highlights', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlightId, accessToken: token }),
    })
  }

  // ── 이메일 인증 처리 ───────────────────────────
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setVerifying(true)
    const res = await fetch('/api/verify-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email: emailInput }),
    })
    const data = await res.json()
    if (!res.ok) {
      setErrorMsg(data.error ?? '인증에 실패했습니다')
      setVerifying(false)
      return
    }
    setReviewerEmail(data.reviewerEmail ?? emailInput)
    setStep('viewer')
  }

  // ── 설문 제출 처리 ─────────────────────────────
  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSurveyError('')

    if (!rating) { setSurveyError('별점을 선택해주세요.'); return }
    if (!oneLiner.trim()) { setSurveyError('한줄평을 입력해주세요.'); return }

    setSurveyLoading(true)
    const res = await fetch('/api/survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: token, rating,
        oneLiner: oneLiner.trim(),
        goodPoints: goodPoints.trim(),
        badPoints: badPoints.trim(),
        recommendLevel,
        targetReader: targetReader.join(', '),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setSurveyError(data.error ?? '제출에 실패했습니다.')
      setSurveyLoading(false)
      return
    }
    setSurveySubmitted(true)
    setPhase('done')
    setSurveyLoading(false)
  }

  // ── 공개 리뷰 제출 처리 ───────────────────────
  const handlePublicReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPublicReviewError('')

    if (!publicReviewRating) { setPublicReviewError('별점을 선택해주세요.'); return }
    if (!publicReviewContent.trim()) { setPublicReviewError('리뷰 내용을 입력해주세요.'); return }

    setPublicReviewLoading(true)
    const res = await fetch('/api/public-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: token,
        title: publicReviewTitle.trim() || undefined,
        content: publicReviewContent.trim(),
        rating: publicReviewRating,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setPublicReviewError(data.error ?? '게시에 실패했습니다.')
      setPublicReviewLoading(false)
      return
    }
    setPublicReviewSubmitted(true)
    setPhase('allDone')
    setPublicReviewLoading(false)
  }

  // 공통 인풋 스타일 (fontFamily 명시 — textarea도 포함하여 폰트 통일)
  const inputStyle: React.CSSProperties = {
    width: '100%', height: styles.input.height,
    borderRadius: styles.input.borderRadius, border: styles.input.border,
    padding: '0 14px', fontSize: '15px', color: colors.text,
    background: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
    fontFamily: styles.fontFamily,
  }

  // 설문 라벨 스타일
  const surveyLabelStyle: React.CSSProperties = {
    display: 'block', fontSize: '15px', fontWeight: 600,
    color: colors.titleText, marginBottom: '4px',
  }

  // 현재 테마 색상 설정 (바 배경/텍스트 색에 사용)
  const tc = THEME_CONFIG[theme]

  // ════════════════════════════════════════════════
  // 로딩 화면
  // ════════════════════════════════════════════════
  if (step === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: colors.background,
        color: colors.subText, fontSize: '15px',
      }}>불러오는 중...</div>
    )
  }

  // ════════════════════════════════════════════════
  // 잘못된 링크 / 종료된 캠페인 화면
  // ════════════════════════════════════════════════
  if (step === 'invalid' || step === 'ended') {
    return (
      <div style={{
        minHeight: '100vh', background: colors.background,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px', ...styles.card, padding: '40px', textAlign: 'center' }}>
          <div style={{ margin: '0 0 16px', display: 'flex', justifyContent: 'center' }}>
            <WarningIcon size={48} color={colors.subText} />
          </div>
          <p style={{ margin: 0, fontSize: '16px', color: colors.text }}>
            {step === 'ended' ? '종료된 캠페인입니다' : '잘못된 링크입니다'}
          </p>
          {debugError && (
            <p style={{
              marginTop: '16px', fontSize: '12px', color: colors.danger,
              background: '#FEF2F2', padding: '10px 12px', borderRadius: '6px',
              textAlign: 'left', wordBreak: 'break-all', lineHeight: 1.6,
            }}>
              {debugError}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // 이메일 인증 화면
  // ════════════════════════════════════════════════
  if (step === 'verify-email') {
    return (
      <div style={{
        minHeight: '100vh', background: colors.background,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px', ...styles.card, padding: '40px', boxSizing: 'border-box' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <Logo size="medium" />
            {campaignTitle && (
              <p style={{ margin: '8px 0 0', fontSize: '16px', color: colors.subText }}>{campaignTitle}</p>
            )}
          </div>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: colors.titleText }}>
              이메일을 입력해주세요
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: colors.subText }}>초대받은 이메일 주소를 입력하세요</p>
          </div>
          {errorMsg && (
            <div style={{
              padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px',
              background: '#FEF2F2', border: `1px solid ${colors.danger}`, color: colors.danger,
            }}>{errorMsg}</div>
          )}
          <form onSubmit={handleVerify}>
            <input type="email" placeholder="이메일 주소" value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)} required style={inputStyle} />
            <button type="submit" disabled={verifying}
              onMouseEnter={() => setVerifyBtnHover(true)} onMouseLeave={() => setVerifyBtnHover(false)}
              style={{
                width: '100%', height: styles.button.height, borderRadius: styles.button.borderRadius,
                background: colors.primary, color: '#FFFFFF', fontSize: '15px', fontWeight: 600,
                border: 'none', cursor: verifying ? 'not-allowed' : 'pointer',
                opacity: verifying ? 0.6 : verifyBtnHover ? 0.9 : 1, transition: 'opacity 0.15s', marginTop: '16px',
              }}>
              {verifying ? '확인 중...' : '인증하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // 설문 완료 화면
  // ════════════════════════════════════════════════
  if (step === 'viewer' && phase === 'done') {
    return (
      <div style={{
        minHeight: '100vh', background: colors.background,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px', ...styles.card, padding: '48px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: colors.success,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
          }}>
            <CheckIcon size={24} color="#FFFFFF" />
          </div>

          <p style={{ margin: '20px 0 0', fontSize: '20px', fontWeight: 700, color: colors.titleText }}>
            설문이 제출되었습니다
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>소중한 의견 감사합니다</p>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: colors.subText2 }}>출판사에 익명으로 전달됩니다</p>

          <div style={{ marginTop: '32px' }}>
            {publicReviewSubmitted ? (
              <p style={{ fontSize: '14px', color: colors.success, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                <CheckIcon size={14} color={colors.success} />
                리뷰 게시 완료
              </p>
            ) : (
              <>
                {/* 공개 리뷰 작성 버튼 */}
                <button
                  onClick={() => setPhase('publicReview')}
                  style={{
                    width: '100%', height: '48px', borderRadius: '12px',
                    background: colors.primary, color: '#FFFFFF',
                    border: 'none', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                  }}
                >공개 리뷰 작성하기</button>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: colors.subText2, textAlign: 'center' }}>
                  뎁스북 피드에 공개되는 리뷰입니다
                </p>
              </>
            )}
          </div>

          {/* 홈으로 이동 버튼 (원고로 돌아가기/건너뛰기 대신) */}
          <button
            onClick={() => { window.location.href = '/' }}
            style={{
              width: '100%', height: '44px', borderRadius: '10px',
              background: 'none', border: `1px solid ${colors.border}`,
              color: colors.text, fontSize: '15px', cursor: 'pointer', marginTop: '12px',
            }}
          >홈으로 이동</button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // 공개 리뷰 작성 화면
  // ════════════════════════════════════════════════
  if (step === 'viewer' && phase === 'publicReview') {
    return (
      <div style={{ minHeight: '100vh', background: colors.background }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 20px 60px' }}>
          <BackButton onClick={() => setPhase('done')} label="돌아가기" />

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Logo size="medium" />
            <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>{campaignTitle}</p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: colors.titleText }}>공개 리뷰 작성</p>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: colors.subText }}>
              뎁스북 피드에 공개되어 다른 독자들이 볼 수 있습니다
            </p>
          </div>

          <form onSubmit={handlePublicReviewSubmit}>
            <div style={{ ...styles.card, padding: '32px' }}>
              <label style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: colors.text, marginBottom: '10px' }}>
                별점 <span style={{ color: colors.danger }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span key={star} onClick={() => setPublicReviewRating(star)}
                    onMouseEnter={() => setPublicReviewHoverRating(star)}
                    onMouseLeave={() => setPublicReviewHoverRating(0)}
                    style={{
                      cursor: 'pointer', lineHeight: 1,
                      color: star <= (publicReviewHoverRating || publicReviewRating) ? '#FBBF24' : colors.border,
                      transform: star <= (publicReviewHoverRating || publicReviewRating) ? 'scale(1.2)' : 'scale(1)',
                      transition: 'color 0.1s, transform 0.1s', display: 'inline-block',
                    }}>
                    <StarIcon size={32} filled={star <= (publicReviewHoverRating || publicReviewRating)} color={star <= (publicReviewHoverRating || publicReviewRating) ? '#FBBF24' : colors.border} />
                  </span>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>
                리뷰 제목 <span style={{ fontSize: '13px', fontWeight: 400, color: colors.subText2 }}>(선택)</span>
              </label>
              <input type="text" value={publicReviewTitle}
                onChange={(e) => setPublicReviewTitle(e.target.value)}
                placeholder="리뷰 제목을 입력하세요"
                style={{
                  width: '100%', height: styles.input.height,
                  borderRadius: styles.input.borderRadius, border: styles.input.border,
                  padding: '0 14px', fontSize: '15px', color: colors.text,
                  background: '#FFFFFF', outline: 'none', boxSizing: 'border-box', marginBottom: '24px',
                }} />

              <label style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: colors.text, marginBottom: '8px' }}>
                리뷰 내용 <span style={{ color: colors.danger }}>*</span>
              </label>
              <textarea value={publicReviewContent} onChange={(e) => setPublicReviewContent(e.target.value)}
                placeholder="이 원고에 대한 솔직한 리뷰를 작성해주세요. 어떤 점이 좋았는지, 어떤 독자에게 추천하고 싶은지 자유롭게 적어주세요."
                style={{
                  width: '100%', height: '200px',
                  borderRadius: styles.input.borderRadius, border: styles.input.border,
                  padding: '12px 14px', fontSize: '15px', color: colors.text,
                  background: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
                  resize: 'vertical', lineHeight: 1.6, fontFamily: styles.fontFamily,
                }} />
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: colors.subText2, textAlign: 'right' }}>
                {publicReviewContent.length}자
              </p>

              {publicReviewError && (
                <p style={{
                  margin: '16px 0 0', fontSize: '14px', color: colors.danger,
                  background: '#FEF2F2', border: `1px solid ${colors.danger}`,
                  padding: '10px 12px', borderRadius: '8px',
                }}>{publicReviewError}</p>
              )}
            </div>

            <button type="submit" disabled={publicReviewLoading}
              style={{
                width: '100%', height: '48px', borderRadius: '12px',
                background: colors.primary, color: '#FFFFFF', border: 'none',
                fontSize: '16px', fontWeight: 600,
                cursor: publicReviewLoading ? 'not-allowed' : 'pointer',
                opacity: publicReviewLoading ? 0.6 : 1, marginTop: '24px',
              }}>
              {publicReviewLoading ? '게시 중...' : '리뷰 게시하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // 최종 완료 화면 (공개 리뷰까지 완료)
  // ════════════════════════════════════════════════
  if (step === 'viewer' && phase === 'allDone') {
    return (
      <div style={{
        minHeight: '100vh', background: colors.background,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px', ...styles.card, padding: '48px', textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: colors.success,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
          }}>
            <CheckIcon size={24} color="#FFFFFF" />
          </div>

          <p style={{ margin: '20px 0 0', fontSize: '20px', fontWeight: 700, color: colors.titleText }}>
            리뷰가 게시되었습니다
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>
            뎁스북 피드에서 확인할 수 있습니다
          </p>

          <button
            onClick={() => (window.location.href = '/feed')}
            style={{
              width: '100%', height: '48px', borderRadius: '12px',
              background: colors.primary, color: '#FFFFFF',
              border: 'none', fontSize: '15px', fontWeight: 600,
              cursor: 'pointer', marginTop: '32px',
            }}
          >피드에서 보기</button>

          {/* 홈으로 버튼 (원고로 돌아가기 대신) */}
          <button
            onClick={() => { window.location.href = '/' }}
            style={{
              width: '100%', height: '44px', borderRadius: '10px',
              background: 'none', border: `1px solid ${colors.border}`,
              color: colors.text, fontSize: '15px', cursor: 'pointer', marginTop: '12px',
            }}
          >홈으로</button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // 설문 작성 화면
  // ════════════════════════════════════════════════
  if (step === 'viewer' && phase === 'survey') {
    return (
      <div style={{ minHeight: '100vh', background: colors.background }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 20px 60px' }}>
          <BackButton onClick={() => setPhase('viewer')} label="원고로 돌아가기" />

          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Logo size="medium" />
            {campaignTitle && (
              <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>{campaignTitle}</p>
            )}
          </div>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: colors.titleText }}>
              읽은 소감을 들려주세요
            </p>
            <p style={{ margin: 0, fontSize: '14px', color: colors.subText }}>솔직한 의견이 출판사에 큰 도움이 됩니다</p>
          </div>

          <form onSubmit={handleSurveySubmit}>
            <div style={{ ...styles.card, padding: '32px' }}>

              {/* 별점 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={surveyLabelStyle}>이 원고에 별점을 매겨주세요 *</label>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}
                      style={{
                        cursor: 'pointer',
                        color: star <= (hoverRating || rating) ? '#FBBF24' : '#E2E8F0',
                        transform: star <= (hoverRating || rating) ? 'scale(1.2)' : 'scale(1)',
                        transition: 'color 0.1s, transform 0.1s', userSelect: 'none', display: 'inline-block',
                      }}>
                      <StarIcon size={32} filled={star <= (hoverRating || rating)} color={star <= (hoverRating || rating) ? '#FBBF24' : '#E2E8F0'} />
                    </span>
                  ))}
                </div>
              </div>

              {/* 한줄평 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={surveyLabelStyle}>한줄평 *</label>
                <p style={{ margin: '0 0 8px', fontSize: '13px', color: colors.subText2 }}>이 원고를 한 문장으로 표현한다면?</p>
                <input type="text" placeholder="원고에 대한 한줄평을 남겨주세요"
                  value={oneLiner} onChange={(e) => setOneLiner(e.target.value)} style={inputStyle} />
              </div>

              {/* 좋았던 점 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ ...surveyLabelStyle, fontWeight: 500 }}>좋았던 점</label>
                <textarea placeholder="인상적이었거나 좋았던 부분을 적어주세요"
                  value={goodPoints} onChange={(e) => setGoodPoints(e.target.value)}
                  style={{ ...inputStyle, height: '100px', padding: '12px 14px', resize: 'vertical', lineHeight: '1.5' }} />
              </div>

              {/* 아쉬운 점 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ ...surveyLabelStyle, fontWeight: 500 }}>아쉬운 점</label>
                <textarea placeholder="아쉬웠거나 개선되면 좋을 부분을 적어주세요"
                  value={badPoints} onChange={(e) => setBadPoints(e.target.value)}
                  style={{ ...inputStyle, height: '100px', padding: '12px 14px', resize: 'vertical', lineHeight: '1.5' }} />
              </div>

              {/* 추천 의향 */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ ...surveyLabelStyle, fontWeight: 500 }}>이 원고를 다른 사람에게 추천하시겠습니까?</label>
                <div style={{ marginTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: colors.subText2, minWidth: '28px' }}>전혀</span>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button key={level} type="button" onClick={() => setRecommendLevel(level)}
                        style={{
                          width: '50px', height: '44px', borderRadius: '10px',
                          border: recommendLevel === level ? 'none' : `1px solid ${colors.border}`,
                          background: recommendLevel === level ? colors.primary : colors.subBackground,
                          color: recommendLevel === level ? '#FFFFFF' : colors.text,
                          fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                          transform: recommendLevel === level ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.15s',
                        }}>{level}</button>
                    ))}
                    <span style={{ fontSize: '12px', color: colors.subText2, minWidth: '28px' }}>매우</span>
                  </div>
                </div>
              </div>

              {/* 타깃 독자 */}
              <div>
                <label style={{ ...surveyLabelStyle, fontWeight: 500 }}>
                  이 책이 어울릴 독자는?
                  <span style={{ fontSize: '13px', fontWeight: 400, color: colors.subText2, marginLeft: '6px' }}>(복수 선택 가능)</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                  {['10대 청소년', '20대 대학생', '20~30대 직장인', '30~40대 부모', '50대 이상',
                    '문학 애호가', '자기계발에 관심 있는 사람', '전문가/연구자',
                    '에세이를 좋아하는 사람', '가볍게 읽고 싶은 사람'].map((option) => {
                    const selected = targetReader.includes(option)
                    return (
                      <button key={option} type="button"
                        onClick={() => setTargetReader((prev) =>
                          prev.includes(option) ? prev.filter((v) => v !== option) : [...prev, option]
                        )}
                        style={{
                          padding: '8px 16px', borderRadius: '20px', fontSize: '14px',
                          cursor: 'pointer', transition: 'all 0.15s',
                          transform: selected ? 'scale(1.04)' : 'scale(1)',
                          background: selected ? '#EEF2FF' : colors.subBackground,
                          border: `1px solid ${selected ? colors.primary : colors.border}`,
                          color: selected ? colors.primary : colors.text,
                          fontWeight: selected ? 600 : 400,
                        }}>{option}</button>
                    )
                  })}
                </div>
              </div>
            </div>

            {surveyError && (
              <div style={{
                marginTop: '16px', padding: '12px', borderRadius: '8px', fontSize: '14px',
                background: '#FEF2F2', border: `1px solid ${colors.danger}`, color: colors.danger,
              }}>{surveyError}</div>
            )}

            <button type="submit" disabled={surveyLoading}
              onMouseEnter={() => setSubmitBtnHover(true)} onMouseLeave={() => setSubmitBtnHover(false)}
              style={{
                width: '100%', height: styles.button.height, borderRadius: styles.button.borderRadius,
                background: colors.primary, color: '#FFFFFF', fontSize: '16px', fontWeight: 600, border: 'none',
                cursor: surveyLoading ? 'not-allowed' : 'pointer',
                opacity: surveyLoading ? 0.6 : submitBtnHover ? 0.9 : 1,
                transition: 'opacity 0.15s', marginTop: '24px',
              }}>
              {surveyLoading ? '제출 중...' : '설문 제출하기'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════
  // epub 뷰어 화면 (phase === 'viewer')
  // ════════════════════════════════════════════════
  return (
    <div
      style={{
        height: '100vh', width: '100vw', display: 'flex',
        flexDirection: 'column', background: tc.bg, overflow: 'hidden',
      }}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={(e) => {
        // 설정 패널 바깥 클릭 시 닫기
        if (showSettingsPanel) setShowSettingsPanel(false)
        resetHideTimer()
      }}
    >
      {/* 개발자 도구 감지 경고 오버레이 */}
      {showDevToolsWarning && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
        }}>
          <div style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#FFFFFF' }}>
            <WarningIcon size={24} color="#FFFFFF" />
            <span style={{ fontSize: '24px' }}>개발자 도구가 감지되었습니다</span>
          </div>
          <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.7)' }}>
            원고 보호를 위해 개발자 도구를 닫아주세요
          </p>
        </div>
      )}

      {/* 목차 패널 뒤 반투명 오버레이 — 클릭하면 패널 닫힘 */}
      {showTocPanel && (
        <div
          onClick={() => setShowTocPanel(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 45,
            background: 'rgba(0,0,0,0.3)',
          }}
        />
      )}

      {/* 목차 사이드 패널 (왼쪽에서 슬라이드) */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0,
        width: isMobile ? '85vw' : '280px',
        background: '#FFFFFF',
        borderRight: `1px solid ${colors.border}`,
        boxShadow: '4px 0 20px rgba(0,0,0,0.08)',
        zIndex: 50,
        transform: showTocPanel ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.25s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 목차 패널 상단 헤더 */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${colors.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: colors.titleText }}>목차</span>
          <button
            onClick={() => setShowTocPanel(false)}
            style={{
              background: 'none', border: 'none',
              cursor: 'pointer', color: colors.subText, padding: '2px',
              display: 'flex', alignItems: 'center',
            }}
          ><CloseIcon size={18} /></button>
        </div>

        {/* 목차 항목 목록 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tocItems.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: '14px', color: colors.subText, padding: '40px 20px' }}>
              목차를 불러오는 중...
            </p>
          ) : (
            tocItems.map((item, index) => {
              // href 일부 일치로 현재 챕터 판별
              const isActive = currentChapterHref
                ? (currentChapterHref.includes(item.href) || item.href.includes(currentChapterHref))
                : false
              const isHovered = hoveredTocIndex === index
              return (
                <div
                  key={index}
                  onClick={() => {
                    renditionRef.current?.display(item.href)
                    setShowTocPanel(false)
                  }}
                  onMouseEnter={() => setHoveredTocIndex(index)}
                  onMouseLeave={() => setHoveredTocIndex(null)}
                  style={{
                    padding: '12px 20px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    color: isActive ? colors.primary : colors.text,
                    background: isActive ? '#F0F4FF' : isHovered ? colors.subBackground : 'transparent',
                    borderLeft: isActive ? `3px solid ${colors.primary}` : '3px solid transparent',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'background 0.1s',
                    lineHeight: 1.5,
                  }}
                >
                  {item.label || `챕터 ${index + 1}`}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 상단 바 */}
      <div style={{
        height: '56px', minHeight: '56px',
        background: tc.barBg,
        boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '0 12px' : '0 20px',
        gap: '8px', position: 'relative', zIndex: 20,
        opacity: barsVisible ? 1 : 0,
        transform: barsVisible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: barsVisible ? 'auto' : 'none',
      }}>
        {/* 왼쪽: 목차 버튼 + 로고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowTocPanel((v) => !v) }}
            title="목차"
            style={{
              background: 'none', border: 'none', fontSize: '20px',
              color: showTocPanel ? colors.primary : tc.barText,
              cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
              display: 'flex', alignItems: 'center',
            }}
          ><MenuIcon size={20} /></button>
          <Logo size="small" />
        </div>

        {/* 가운데: 캠페인 제목 (모바일 숨김) */}
        {!isMobile && (
          <span style={{
            flex: 1, fontSize: '14px',
            color: tc.barText, opacity: 0.6,
            textAlign: 'center', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px',
          }}>
            {campaignTitle}
          </span>
        )}

        {/* 오른쪽: 하이라이트 + 설정 + 진행률 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowHighlightPanel((v) => !v) }}
            title="내 하이라이트"
            style={{
              background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer',
              padding: '4px', lineHeight: 1,
              color: showHighlightPanel ? colors.primary : tc.barText,
              display: 'flex', alignItems: 'center',
            }}
          ><HighlightIcon size={20} /></button>

          {/* 설정 버튼 — "Aa" 텍스트로 글자 설정 느낌을 명확히 표현 */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowSettingsPanel((v) => !v) }}
            title="글자 설정"
            style={{
              background: showSettingsPanel ? colors.primary : colors.subBackground,
              border: 'none', cursor: 'pointer',
              borderRadius: '6px', padding: '6px 10px', lineHeight: 1,
              color: showSettingsPanel ? '#FFFFFF' : tc.barText,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 600 }}>Aa</span>
          </button>

          <span style={{ fontSize: '13px', color: tc.barText, opacity: 0.6, whiteSpace: 'nowrap' }}>
            {totalPages > 0 ? `${progress}%` : ''}
          </span>
        </div>

        {/* 설정 드롭다운 패널 */}
        {showSettingsPanel && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              right: isMobile ? '8px' : '20px',
              top: '60px',
              width: isMobile ? 'calc(100vw - 16px)' : '280px',
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: `1px solid ${colors.border}`,
              zIndex: 60,
            }}
          >
            {/* 테마 선택 */}
            <div style={{ marginBottom: '20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: colors.subText, fontWeight: 500 }}>테마</p>
              {/* 밝은 / 어두운 두 가지 원형 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {([
                  { key: 'light' as Theme, bg: '#FFFFFF', label: '밝은' },
                  { key: 'dark'  as Theme, bg: '#1A1A2E', label: '어두운' },
                ]).map(({ key, bg, label }) => (
                  <button
                    key={key}
                    onClick={() => applyTheme(key)}
                    title={label}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: bg,
                      border: theme === key
                        ? `2px solid ${colors.primary}`
                        : key === 'light' ? `2px solid ${colors.border}` : '2px solid transparent',
                      cursor: 'pointer', flexShrink: 0, padding: 0,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                    }}
                  />
                ))}
                <span style={{ fontSize: '13px', color: colors.subText, marginLeft: '4px' }}>
                  {theme === 'dark' ? '어두운' : '밝은'}
                </span>
              </div>
            </div>

            {/* 글자 크기 슬라이더 */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: colors.subText, fontWeight: 500 }}>
                글자 크기 ({fontSize}%)
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: colors.subText2, userSelect: 'none' }}>가</span>
                <input
                  type="range" min={80} max={150} step={10} value={fontSize}
                  onChange={(e) => applyFontSize(Number(e.target.value))}
                  style={{ flex: 1, accentColor: colors.primary } as React.CSSProperties}
                />
                <span style={{ fontSize: '18px', color: colors.subText2, userSelect: 'none' }}>가</span>
              </div>
            </div>

            {/* 줄간격 슬라이더 */}
            <div style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: colors.subText, fontWeight: 500 }}>
                줄간격 ({lineHeight.toFixed(1)})
              </p>
              <input
                type="range" min={1.2} max={2.2} step={0.2} value={lineHeight}
                onChange={(e) => applyLineHeight(Number(e.target.value))}
                style={{ width: '100%', accentColor: colors.primary } as React.CSSProperties}
              />
            </div>

            {/* 여백 슬라이더 */}
            <div>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: colors.subText, fontWeight: 500 }}>
                여백 ({margin}px)
              </p>
              <input
                type="range" min={0} max={60} step={10} value={margin}
                onChange={(e) => applyMargin(Number(e.target.value))}
                style={{ width: '100%', accentColor: colors.primary } as React.CSSProperties}
              />
            </div>
          </div>
        )}
      </div>

      {/* 중간 영역 (epub + 하이라이트 패널) */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative' }}>

        {/* epub 렌더링 영역 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {epubLoading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '16px', color: colors.subText,
              background: tc.bg, zIndex: 10,
            }}>
              원고를 불러오는 중...
            </div>
          )}

          {/* 워터마크 오버레이 (테마에 맞게 색상 변경) */}
          {!epubLoading && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              pointerEvents: 'none', overflow: 'hidden', zIndex: 5,
            }}>
              {WATERMARK_POSITIONS.map((pos, i) => (
                <div key={i} style={{
                  position: 'absolute', top: pos.top, left: pos.left,
                  transform: 'rotate(-30deg)', whiteSpace: 'nowrap',
                  fontSize: '14px', color: tc.watermark, userSelect: 'none',
                }}>
                  {reviewerEmail} · {viewerOpenedAtRef.current}
                </div>
              ))}
            </div>
          )}

          <div ref={viewerRef} style={{ width: '100%', height: '100%' }} />

          {/* 샘플 비율 초과 차단 오버레이 */}
          {showSampleLimit && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.72)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '32px', textAlign: 'center',
            }}>
              <p style={{
                margin: 0, fontSize: '20px', fontWeight: 700,
                color: '#FFFFFF', lineHeight: 1.4,
              }}>
                여기까지 미리보기입니다
              </p>
              <p style={{
                margin: '12px 0 0', fontSize: '15px',
                color: 'rgba(255,255,255,0.72)', lineHeight: 1.6,
              }}>
                전체 원고는 완본 캠페인에서 확인할 수 있습니다
              </p>
              {/* 이전 페이지 버튼 — prev는 항상 허용 */}
              <button
                onClick={() => renditionRef.current?.prev()}
                style={{
                  marginTop: '28px', height: '44px', padding: '0 28px',
                  borderRadius: '10px', background: '#FFFFFF',
                  color: colors.primary, fontSize: '15px', fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                }}
              >
                <ArrowLeftIcon size={16} />
                이전 페이지
              </button>
            </div>
          )}
        </div>

        {/* 하이라이트 사이드 패널 */}
        {showHighlightPanel && (
          <div style={{
            width: isMobile ? '100%' : '320px',
            position: isMobile ? 'absolute' : 'relative',
            top: 0, right: 0, bottom: 0,
            background: '#FFFFFF', borderLeft: `1px solid ${colors.border}`,
            display: 'flex', flexDirection: 'column', zIndex: 30,
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: `1px solid ${colors.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '16px', fontWeight: 600, color: colors.titleText }}>내 하이라이트</span>
              <button onClick={() => setShowHighlightPanel(false)} style={{
                background: 'none', border: 'none',
                cursor: 'pointer', color: colors.subText, padding: '2px',
                display: 'flex', alignItems: 'center',
              }}><CloseIcon size={18} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {highlights.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: '14px', color: colors.subText, padding: '40px 0' }}>
                  아직 하이라이트가 없습니다
                </p>
              ) : (
                highlights.map((hl) => (
                  <div key={hl.id} style={{
                    padding: '12px', borderRadius: '8px', marginBottom: '8px',
                    background: '#FFFBEB', borderLeft: '3px solid #FBBF24', position: 'relative',
                  }}>
                    <div
                      onClick={() => renditionRef.current?.display(hl.cfi_range)}
                      style={{ cursor: 'pointer', paddingRight: '24px' }}
                    >
                      <p style={{
                        margin: 0, fontSize: '13px', color: colors.text, lineHeight: 1.6,
                        display: '-webkit-box', WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>{hl.text}</p>
                      {hl.chapter_label && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: colors.subText2 }}>
                          {hl.chapter_label}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteHighlight(hl.id, hl.cfi_range) }}
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        background: 'none', border: 'none',
                        fontSize: '13px', color: colors.subText2,
                        cursor: 'pointer', padding: '2px 4px', lineHeight: 1,
                      }}
                      title="하이라이트 삭제"
                    ><CloseIcon size={14} /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 진행률 바 — 하단 바 바로 위의 얇은 트랙 */}
      <div style={{
        height: '3px',
        background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : colors.border,
        position: 'relative',
        flexShrink: 0,
        opacity: barsVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${progress}%`,
          background: colors.primary,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* 하단 바 */}
      <div style={{
        height: '56px', minHeight: '56px',
        background: tc.barBg,
        boxShadow: theme === 'dark' ? '0 -2px 8px rgba(0,0,0,0.3)' : '0 -2px 8px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px',
        position: 'relative', zIndex: 20,
        flexShrink: 0,
        opacity: barsVisible ? 1 : 0,
        transform: barsVisible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: barsVisible ? 'auto' : 'none',
      }}>
        {/* 이전/진행률/다음 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '24px' }}>
          <button onClick={() => renditionRef.current?.prev()} disabled={atStart} style={{
            background: 'none', border: 'none', fontSize: '14px',
            color: atStart ? (theme === 'dark' ? 'rgba(212,212,216,0.3)' : colors.subText2) : tc.barText,
            cursor: atStart ? 'default' : 'pointer',
            padding: isMobile ? '8px 6px' : '8px', minHeight: '44px',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}><ArrowLeftIcon size={14} />이전</button>
          <span style={{ fontSize: '14px', color: tc.barText, opacity: 0.6, minWidth: '36px', textAlign: 'center' }}>
            {totalPages > 0 ? `${progress}%` : '—'}
          </span>
          <button onClick={() => renditionRef.current?.next()} disabled={atEnd} style={{
            background: 'none', border: 'none', fontSize: '14px',
            color: atEnd ? (theme === 'dark' ? 'rgba(212,212,216,0.3)' : colors.subText2) : tc.barText,
            cursor: atEnd ? 'default' : 'pointer',
            padding: isMobile ? '8px 6px' : '8px', minHeight: '44px',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>다음<ArrowRightIcon size={14} /></button>
        </div>

        {/* 설문 버튼 or 완료 텍스트 */}
        {!surveySubmitted ? (
          <button onClick={() => setPhase('survey')} style={{
            background: colors.primary, color: '#FFFFFF', border: 'none',
            padding: isMobile ? '8px 10px' : '8px 16px', borderRadius: '8px',
            fontSize: isMobile ? '12px' : '13px', fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap', minHeight: '44px',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>설문 작성<ArrowRightIcon size={14} /></button>
        ) : !publicReviewSubmitted ? (
          <button onClick={() => setPhase('publicReview')} style={{
            background: 'none', color: colors.primary, border: `1px solid ${colors.primary}`,
            padding: isMobile ? '8px 10px' : '8px 16px', borderRadius: '8px',
            fontSize: isMobile ? '12px' : '13px', fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap', minHeight: '44px',
            display: 'inline-flex', alignItems: 'center', gap: '6px',
          }}>공개 리뷰 작성<ArrowRightIcon size={14} /></button>
        ) : (
          <span style={{ fontSize: '13px', fontWeight: 600, color: colors.success, paddingRight: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckIcon size={14} color={colors.success} />
            모두 완료
          </span>
        )}
      </div>

      {/* 북마크 복원 토스트 */}
      {bookmarkToast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, background: colors.titleText, color: '#FFFFFF',
          padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
          pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap',
        }}>
          이전에 읽던 위치로 이동했습니다
        </div>
      )}

      {/* 하이라이트 저장 성공 토스트 */}
      {highlightToast && (
        <div style={{
          position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
          zIndex: 200, background: colors.titleText, color: '#FFFFFF',
          padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
          pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}>
          하이라이트 저장됨
        </div>
      )}

      {/* 하이라이트 팝업 */}
      {highlightPopup && (
        <div style={{
          position: 'fixed',
          left: highlightPopup.x, top: highlightPopup.y - 44,
          transform: 'translateX(-50%)', zIndex: 100,
        }}>
          <button onClick={handleHighlight} style={{
            background: colors.primary, color: '#FFFFFF', border: 'none',
            padding: '6px 14px', borderRadius: '8px', fontSize: '13px',
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
          }}>✨ 하이라이트</button>
          <div style={{
            position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
            borderTop: `6px solid ${colors.primary}`,
          }} />
        </div>
      )}
    </div>
  )
}

// useSearchParams()는 Suspense 경계 안에서만 사용 가능 (Next.js 14 요구사항)
export default function ViewerPage() {
  return (
    <Suspense>
      <ViewerPageInner />
    </Suspense>
  )
}
