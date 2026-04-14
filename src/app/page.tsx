'use client'

// 랜딩 페이지 - 히어로 섹션
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

export default function HomePage() {
  const router = useRouter()

  // 버튼 호버 상태
  const [publisherHover, setPublisherHover] = useState(false)
  const [reviewerHover, setReviewerHover] = useState(false)
  const [feedHover, setFeedHover] = useState(false)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.background,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 상단 내비게이션 */}
      <nav
        style={{
          height: '60px',
          background: '#FFFFFF',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <Logo size="small" />
        <button
          onClick={() => router.push('/feed')}
          onMouseEnter={() => setFeedHover(true)}
          onMouseLeave={() => setFeedHover(false)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '14px',
            color: feedHover ? colors.text : colors.subText,
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
        >
          리뷰 피드 보기
        </button>
      </nav>

      {/* 히어로 섹션 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          textAlign: 'center',
        }}
      >
        {/* 로고 */}
        <Logo size="large" />

        {/* 태그라인 */}
        <p
          style={{
            margin: '20px 0 12px',
            fontSize: '28px',
            fontWeight: 700,
            color: colors.titleText,
            lineHeight: 1.4,
          }}
        >
          출판 전, 독자의 목소리를 먼저 들으세요
        </p>
        <p
          style={{
            margin: '0 0 48px',
            fontSize: '16px',
            color: colors.subText,
            maxWidth: '480px',
            lineHeight: 1.7,
          }}
        >
          뎁스북은 출판사와 리뷰어를 연결하는 사전 피드백 플랫폼입니다.
          원고를 읽은 독자의 솔직한 반응을 출판 전에 확인하세요.
        </p>

        {/* CTA 버튼 그룹 */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {/* 출판사 시작하기 */}
          <button
            onClick={() => router.push('/publisher/login')}
            onMouseEnter={() => setPublisherHover(true)}
            onMouseLeave={() => setPublisherHover(false)}
            style={{
              height: '52px',
              padding: '0 32px',
              borderRadius: styles.button.borderRadius,
              background: colors.primary,
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transform: publisherHover ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: publisherHover
                ? '0 6px 20px rgba(29,53,87,0.25)'
                : '0 2px 8px rgba(29,53,87,0.15)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            출판사로 시작하기
          </button>

          {/* 리뷰어 신청 */}
          <button
            onClick={() => router.push('/reviewer/login')}
            onMouseEnter={() => setReviewerHover(true)}
            onMouseLeave={() => setReviewerHover(false)}
            style={{
              height: '52px',
              padding: '0 32px',
              borderRadius: styles.button.borderRadius,
              background: '#FFFFFF',
              color: colors.primary,
              fontSize: '16px',
              fontWeight: 600,
              border: `1.5px solid ${colors.primary}`,
              cursor: 'pointer',
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
        <p
          style={{
            margin: '32px 0 0',
            fontSize: '13px',
            color: colors.subText2,
          }}
        >
          일반 독자이신가요?{' '}
          <span
            onClick={() => router.push('/reader/signup')}
            style={{
              color: colors.subText,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            독자로 가입하기
          </span>
        </p>
      </div>

      {/* 특징 섹션 */}
      <div
        style={{
          background: '#FFFFFF',
          padding: '60px 20px',
        }}
      >
        <div
          style={{
            maxWidth: styles.maxWidth,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '32px',
            textAlign: 'center',
          }}
        >
          {[
            {
              icon: '📖',
              title: '원고 열람',
              desc: 'epub 뷰어로 원고를 편하게 읽을 수 있습니다',
            },
            {
              icon: '✏️',
              title: '하이라이트 & 피드백',
              desc: '인상적인 문장에 하이라이트를 남기고 설문에 답변하세요',
            },
            {
              icon: '📊',
              title: '리포트 분석',
              desc: '별점, 한줄평, 하이라이트를 한눈에 확인하세요',
            },
          ].map((item) => (
            <div key={item.title}>
              <p style={{ margin: '0 0 12px', fontSize: '36px' }}>{item.icon}</p>
              <p
                style={{
                  margin: '0 0 8px',
                  fontSize: '17px',
                  fontWeight: 700,
                  color: colors.titleText,
                }}
              >
                {item.title}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  color: colors.subText,
                  lineHeight: 1.7,
                }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
