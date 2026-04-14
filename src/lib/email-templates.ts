// 이메일 HTML 템플릿 모음
// 각 함수는 { subject, html } 을 반환
// 이메일 클라이언트 호환성을 위해 인라인 스타일만 사용

// 브랜드 색상 (design.ts와 동기화)
const PRIMARY = '#1D3557'
const TEXT    = '#333E4F'
const SUBTEXT = '#64748B'
const BORDER  = '#E2E8F0'

// 공통 레이아웃 래퍼 — 모든 이메일의 바깥쪽 틀
function emailWrapper(content: string): string {
  return `
    <div style="max-width: 560px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: ${TEXT}; padding: 40px 20px;">
      <!-- 로고 영역 -->
      <div style="text-align: center; margin-bottom: 32px;">
        <span style="font-size: 24px; font-weight: 800; color: ${PRIMARY}; letter-spacing: -2px;">DepthBook</span>
      </div>

      <!-- 본문 -->
      ${content}

      <!-- 하단 안내 -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid ${BORDER}; text-align: center; font-size: 12px; color: ${SUBTEXT};">
        이 메일은 DepthBook에서 발송되었습니다.
      </div>
    </div>
  `
}

// 버튼 HTML 조각
function emailButton(href: string, label: string): string {
  return `
    <a href="${href}"
       style="display: inline-block; background: ${PRIMARY}; color: #fff; padding: 12px 32px;
              border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 600;">
      ${label}
    </a>
  `
}

// ── 출간 알림 ─────────────────────────────────
// 읽고 싶다 등록 독자에게 발송
export function publishNotificationEmail(
  campaignTitle: string,
  purchaseUrl: string,
): { subject: string; html: string } {
  return {
    subject: `📚 관심 등록하신 "${campaignTitle}"이(가) 출간되었습니다!`,
    html: emailWrapper(`
      <h2 style="font-size: 20px; font-weight: 700; color: #101828; margin: 0 0 16px;">출간 소식을 전해드립니다</h2>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        관심 등록하신 <strong>"${campaignTitle}"</strong>이(가) 출간되었습니다!<br/>
        지금 바로 만나보세요.
      </p>
      ${emailButton(purchaseUrl, '지금 구매하기')}
    `),
  }
}

// ── 캠페인 초대 ───────────────────────────────
// 리뷰어 초대 링크와 함께 발송
export function campaignInviteEmail(
  campaignTitle: string,
  inviteLink: string,
): { subject: string; html: string } {
  return {
    subject: `📖 "${campaignTitle}" 원고 리뷰에 초대합니다`,
    html: emailWrapper(`
      <h2 style="font-size: 20px; font-weight: 700; color: #101828; margin: 0 0 16px;">원고 리뷰 초대</h2>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        <strong>"${campaignTitle}"</strong> 원고의 리뷰어로 초대되었습니다.<br/>
        아래 버튼을 눌러 신청해주세요.
      </p>
      ${emailButton(inviteLink, '참여하기')}
    `),
  }
}

// ── 설문 완료 감사 ────────────────────────────
// 리뷰어가 설문을 제출했을 때 발송
export function surveyThankYouEmail(
  campaignTitle: string,
): { subject: string; html: string } {
  return {
    subject: `감사합니다! "${campaignTitle}" 설문이 제출되었습니다`,
    html: emailWrapper(`
      <h2 style="font-size: 20px; font-weight: 700; color: #101828; margin: 0 0 16px;">설문 제출 완료</h2>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
        <strong>"${campaignTitle}"</strong>에 대한 소중한 의견 감사합니다.
      </p>
      <p style="font-size: 14px; color: ${SUBTEXT}; line-height: 1.6; margin: 0;">
        회원님의 피드백은 출판사에 익명으로 전달됩니다.
      </p>
    `),
  }
}

// ── 리뷰어 참여 승인 ──────────────────────────
// 출판사가 리뷰어를 승인했을 때 발송
export function reviewerApprovedEmail(
  campaignTitle: string,
  viewerLink: string,
): { subject: string; html: string } {
  return {
    subject: `✅ "${campaignTitle}" 리뷰 참여가 승인되었습니다`,
    html: emailWrapper(`
      <h2 style="font-size: 20px; font-weight: 700; color: #101828; margin: 0 0 16px;">참여 승인 완료</h2>
      <p style="font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
        <strong>"${campaignTitle}"</strong> 원고 리뷰 참여가 승인되었습니다.<br/>
        지금 바로 원고를 읽어보세요.
      </p>
      ${emailButton(viewerLink, '원고 읽기')}
    `),
  }
}
