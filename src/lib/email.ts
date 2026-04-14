// 이메일 발송 유틸
// Resend 서비스를 사용해 트랜잭션 이메일을 보냄
// API 키가 없으면 조용히 건너뜀 (개발 환경 대비)
import { Resend } from 'resend'

// 발신자 주소
// Resend 무료 플랜에서는 onboarding@resend.dev 만 사용 가능
// 도메인 인증 후에는 noreply@depthbook.kr 로 변경
const FROM_EMAIL = 'DepthBook <onboarding@resend.dev>'

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<boolean> {
  // API 키 미설정 시 건너뜀
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === '여기에_키_입력') {
    console.log(`[이메일] RESEND_API_KEY 미설정 — 발송 건너뜀 (수신: ${to})`)
    return false
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    })

    if (error) {
      console.error('[이메일 발송 실패]', { to, subject, error })
      return false
    }

    return true
  } catch (err) {
    console.error('[이메일 발송 에러]', { to, subject, err })
    return false
  }
}
