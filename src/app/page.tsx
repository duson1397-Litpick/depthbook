'use client'

// 랜딩 페이지 — 전면 개편
// 히어로 + 작동 방식 + 리포트 항목 + 리뷰어 안내 + 하단 CTA + 푸터
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'
import Footer from '@/components/Footer'

export default function HomePage() {
  const router = useRouter()

  // 버튼/링크 호버 상태
  const [publisherHover, setPublisherHover]       = useState(false)
  const [reviewerHover, setReviewerHover]         = useState(false)
  const [feedHover, setFeedHover]                 = useState(false)
  const [ctaHover, setCtaHover]                   = useState(false)
  const [reviewerLinkHover, setReviewerLinkHover] = useState(false)

  // 모바일 여부 (768px 미만)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return (
    <div style={{ background: colors.background, display: 'flex', flexDirection: 'column' }}>

      {/* ── 상단 고정 내비게이션 ───────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: '60px',
        background: '#FFFFFF',
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <Logo size="small" />
        <button
          onClick={() => router.push('/feed')}
          onMouseEnter={() => setFeedHover(true)}
          onMouseLeave={() => setFeedHover(false)}
          style={{
            background: 'none', border: 'none', fontSize: '14px',
            color: feedHover ? colors.text : colors.subText,
            cursor: 'pointer', transition: 'color 0.15s',
          }}
        >
          리뷰 피드 보기
        </button>
      </nav>

      {/* ── 히어로 섹션 ───────────────────────────── */}
      <div style={{
        background: colors.background,
        padding: isMobile ? '56px 20px 48px' : '80px 20px 64px',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <Logo size="large" />

        {/* 태그라인 */}
        <p style={{
          margin: '20px 0 12px',
          fontSize: isMobile ? '22px' : '28px',
          fontWeight: 700, color: colors.titleText, lineHeight: 1.4,
        }}>
          출간 전, 독자의 목소리를 먼저 들으세요
        </p>
        <p style={{
          margin: '0 0 40px', fontSize: '16px', color: colors.subText,
          maxWidth: '480px', lineHeight: 1.7,
        }}>
          뎁스북은 출판사와 리뷰어를 연결하는 사전 피드백 플랫폼입니다.
          원고를 읽은 독자의 솔직한 반응을 출판 전에 확인하세요.
        </p>

        {/* CTA 버튼 그룹 — 모바일에서 세로 배치 */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: '12px', justifyContent: 'center', alignItems: 'center',
          width: isMobile ? '100%' : 'auto',
        }}>
          <button
            onClick={() => router.push('/publisher/login')}
            onMouseEnter={() => setPublisherHover(true)}
            onMouseLeave={() => setPublisherHover(false)}
            style={{
              height: '52px', minHeight: '44px', padding: '0 32px',
              width: isMobile ? '100%' : 'auto',
              maxWidth: isMobile ? '320px' : 'none',
              borderRadius: styles.button.borderRadius,
              background: colors.primary, color: '#FFFFFF',
              fontSize: '16px', fontWeight: 600, border: 'none', cursor: 'pointer',
              transform: publisherHover ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: publisherHover
                ? '0 6px 20px rgba(29,53,87,0.25)'
                : '0 2px 8px rgba(29,53,87,0.15)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            출판사로 시작하기
          </button>

          <button
            onClick={() => router.push('/reviewer/login')}
            onMouseEnter={() => setReviewerHover(true)}
            onMouseLeave={() => setReviewerHover(false)}
            style={{
              height: '52px', minHeight: '44px', padding: '0 32px',
              width: isMobile ? '100%' : 'auto',
              maxWidth: isMobile ? '320px' : 'none',
              borderRadius: styles.button.borderRadius,
              background: '#FFFFFF', color: colors.primary,
              fontSize: '16px', fontWeight: 600,
              border: `1.5px solid ${colors.primary}`, cursor: 'pointer',
              transform: reviewerHover ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: reviewerHover
                ? '0 6px 20px rgba(29,53,87,0.12)'
                : '0 2px 6px rgba(0,0,0,0.05)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            리뷰어로 참여하기
          </button>
        </div>

        {/* 독자 가입 안내 */}
        <p style={{ margin: '20px 0 0', fontSize: '13px', color: colors.subText2 }}>
          일반 독자이신가요?{' '}
          <span
            onClick={() => router.push('/reader/signup')}
            style={{ color: colors.subText, textDecoration: 'underline', cursor: 'pointer' }}
          >
            독자로 가입하기
          </span>
        </p>

        {/* 리포트 미리보기 카드 — "이런 데이터를 받을 수 있다"는 걸 한눈에 보여줌 */}
        <div style={{
          marginTop: '52px',
          display: 'flex',
          gap: isMobile ? '10px' : '16px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          width: '100%',
          maxWidth: '520px',
        }}>
          {[
            { label: '평균 별점',   value: '4.2', suffix: '/ 5',  star: true  },
            { label: '리뷰어 참여', value: '12',  suffix: '명',    star: false },
            { label: '읽고 싶다',   value: '89',  suffix: '명',    star: false },
          ].map((card) => (
            <div key={card.label} style={{
              flex: 1,
              minWidth: isMobile ? '90px' : '120px',
              background: '#FFFFFF',
              boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
              borderRadius: '12px',
              padding: '14px 16px',
              textAlign: 'center',
            }}>
              <p style={{
                margin: 0, fontSize: '11px', color: colors.subText,
                letterSpacing: '0.3px', fontWeight: 500,
              }}>
                {card.label}
              </p>
              <div style={{
                margin: '6px 0 0',
                display: 'flex', alignItems: 'baseline',
                justifyContent: 'center', gap: '3px',
              }}>
                {card.star && (
                  <span style={{ fontSize: '16px', color: '#FBBF24', lineHeight: 1 }}>★</span>
                )}
                <span style={{ fontSize: '22px', fontWeight: 700, color: colors.titleText }}>
                  {card.value}
                </span>
                <span style={{ fontSize: '13px', color: colors.subText2 }}>{card.suffix}</span>
              </div>
            </div>
          ))}
        </div>
        {/* 카드 아래 캡션 */}
        <p style={{ margin: '12px 0 0', fontSize: '12px', color: colors.subText2 }}>
          ↑ 캠페인 리포트에서 받을 수 있는 데이터 예시
        </p>
      </div>

      {/* ── 어떻게 동작하나요? 섹션 ──────────────── */}
      <div style={{ background: '#FFFFFF', padding: isMobile ? '60px 20px' : '80px 20px' }}>
        <div style={{ maxWidth: styles.maxWidth, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            margin: 0,
            fontSize: isMobile ? '22px' : '28px',
            fontWeight: 700, color: colors.titleText,
          }}>
            어떻게 동작하나요?
          </h2>
          <p style={{ margin: '12px 0 0', fontSize: '16px', color: colors.subText }}>
            원고 업로드부터 리포트 확인까지 3단계
          </p>

          {/* 3단계 — 모바일에서 세로 배치 */}
          <div style={{
            marginTop: '48px',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: isMobile ? '32px' : '40px',
          }}>
            {[
              {
                step: 1,
                title: '원고 업로드',
                desc: 'epub 파일을 업로드하고 캠페인을 만드세요. 리뷰어 수와 마감일을 설정할 수 있습니다.',
              },
              {
                step: 2,
                title: '리뷰어 모집',
                desc: '초대 링크를 직접 보내거나, 뎁스북 리뷰어 풀에서 자동으로 매칭됩니다.',
              },
              {
                step: 3,
                title: '리포트 확인',
                desc: '별점, 한줄평, 하이라이트, 챕터별 체류 시간을 한눈에 볼 수 있습니다.',
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                {/* 번호 원형 */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: colors.primary, color: '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 700, flexShrink: 0,
                }}>
                  {item.step}
                </div>
                <p style={{
                  margin: '16px 0 0', fontSize: '18px', fontWeight: 600,
                  color: colors.titleText, textAlign: 'center',
                }}>
                  {item.title}
                </p>
                <p style={{
                  margin: '8px 0 0', fontSize: '14px', color: colors.subText,
                  lineHeight: 1.6, maxWidth: '240px', textAlign: 'center',
                }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 출판사가 받는 리포트 섹션 ────────────── */}
      <div style={{ background: colors.background, padding: isMobile ? '60px 20px' : '80px 20px' }}>
        <div style={{ maxWidth: styles.maxWidth, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{
            margin: 0,
            fontSize: isMobile ? '22px' : '28px',
            fontWeight: 700, color: colors.titleText,
          }}>
            출판사가 받는 리포트
          </h2>
          <p style={{ margin: '12px 0 0', fontSize: '16px', color: colors.subText }}>
            자본이 아닌 독자 반응으로 좋은 책이 발견됩니다
          </p>

          {/* 리포트 항목 2열 그리드 — 모바일에서 1열 */}
          <div style={{
            marginTop: '48px',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '20px',
            textAlign: 'left',
          }}>
            {[
              {
                title: '익명 설문 리포트',
                desc: '별점, 한줄평, 좋았던 점, 아쉬운 점을 익명으로 수집합니다.',
              },
              {
                title: '하이라이트 문장',
                desc: '리뷰어가 인상적이라고 표시한 문장을 추천 문구 후보로 활용하세요.',
              },
              {
                title: '독자 행동 데이터',
                desc: '챕터별 체류 시간, 이탈 구간을 분석해 원고의 흐름을 파악합니다.',
              },
              {
                title: '사전 수요 측정',
                desc: '"읽고 싶다" 등록 수로 출간 전 관심도를 파악하세요.',
              },
              {
                title: '장르 비교 인사이트',
                desc: '같은 장르 다른 원고와 데이터를 비교해 상대적인 반응을 확인합니다.',
              },
              {
                title: '출간 알림',
                desc: '관심 독자에게 출간 소식과 구매 링크를 자동 발송합니다.',
              },
            ].map((item) => (
              <div key={item.title} style={{ ...styles.card, padding: '24px' }}>
                <p style={{
                  margin: 0, fontSize: '16px', fontWeight: 600, color: colors.titleText,
                }}>
                  {item.title}
                </p>
                <p style={{
                  margin: '8px 0 0', fontSize: '14px', color: colors.subText, lineHeight: 1.6,
                }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 리뷰어에게도 좋습니다 섹션 ───────────── */}
      <div style={{
        background: '#FFFFFF',
        padding: isMobile ? '48px 20px' : '60px 20px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: styles.maxWidth, margin: '0 auto' }}>
          <p style={{
            margin: '0 auto',
            fontSize: '17px', color: colors.text, lineHeight: 1.7,
            maxWidth: '600px',
          }}>
            리뷰어는 출간 전 원고를 먼저 읽고, 등급이 올라갈수록 더 좋은 원고에 우선 접근합니다.
          </p>
          <p style={{ margin: '24px 0 0' }}>
            <span
              onClick={() => router.push('/reviewer/login')}
              onMouseEnter={() => setReviewerLinkHover(true)}
              onMouseLeave={() => setReviewerLinkHover(false)}
              style={{
                fontSize: '16px', fontWeight: 600,
                color: reviewerLinkHover ? colors.primary : colors.info,
                cursor: 'pointer', transition: 'color 0.15s',
              }}
            >
              리뷰어로 참여하기 →
            </span>
          </p>
        </div>
      </div>

      {/* ── 하단 CTA 섹션 ─────────────────────────── */}
      <div style={{
        background: colors.primary,
        padding: isMobile ? '48px 20px' : '60px 20px',
        textAlign: 'center',
      }}>
        <p style={{
          margin: 0,
          fontSize: isMobile ? '22px' : '28px',
          fontWeight: 700, color: '#FFFFFF',
        }}>
          지금 시작하세요
        </p>
        <p style={{ margin: '12px 0 0', fontSize: '16px', color: 'rgba(255,255,255,0.8)' }}>
          첫 캠페인은 무료로 체험할 수 있습니다
        </p>
        <button
          onClick={() => router.push('/publisher/login')}
          onMouseEnter={() => setCtaHover(true)}
          onMouseLeave={() => setCtaHover(false)}
          style={{
            marginTop: '32px',
            height: '52px', minHeight: '44px', padding: '0 40px',
            borderRadius: '12px',
            background: ctaHover ? '#F0F4F8' : '#FFFFFF',
            color: colors.primary,
            fontSize: '16px', fontWeight: 700,
            border: 'none', cursor: 'pointer',
            transition: 'background 0.15s',
          }}
        >
          출판사로 시작하기
        </button>
      </div>

      {/* ── 푸터 ──────────────────────────────────── */}
      <Footer />
    </div>
  )
}
