// 출간 알림 발송 API
// POST { campaignId } — 읽고 싶다 등록 독자들에게 출간 알림 전송
// service_role 사용
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createNotification } from '@/lib/notify'
import { sendEmail } from '@/lib/email'
import { publishNotificationEmail } from '@/lib/email-templates'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const { campaignId } = await request.json()

  if (!campaignId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 1. 캠페인 정보 조회 (제목, 출간일, 구매 링크 확인)
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('title, publication_date, purchase_url')
    .eq('id', campaignId)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: '캠페인을 찾을 수 없습니다' }, { status: 404 })
  }

  if (!campaign.publication_date || !campaign.purchase_url) {
    return NextResponse.json({ error: '출간일과 구매 링크를 먼저 입력해주세요' }, { status: 400 })
  }

  // 2. 읽고 싶다 등록 유저 목록 조회
  const { data: wtrUsers } = await supabase
    .from('want_to_read')
    .select('user_id')
    .eq('campaign_id', campaignId)

  if (!wtrUsers || wtrUsers.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  // 3. 유저 이메일 일괄 조회
  const userIds = wtrUsers.map((u) => u.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('id', userIds)

  const emailMap: Record<string, string> = {}
  for (const p of profiles ?? []) {
    if (p.email) emailMap[p.id] = p.email
  }

  // 4. 각 유저에게 앱 알림 생성 + 이메일 발송 (fire-and-forget)
  const title = campaign.title ?? '관심 도서'
  const { subject, html } = publishNotificationEmail(title, campaign.purchase_url!)
  let sent = 0

  for (const { user_id } of wtrUsers) {
    // 앱 내 알림
    await createNotification({
      userId: user_id,
      type: 'book_published',
      referenceId: campaignId,
      referenceType: 'campaign',
      message: `관심 등록하신 "${title}"이(가) 출간되었습니다!`,
    })

    // 이메일 발송 — 실패해도 나머지는 계속 발송
    const email = emailMap[user_id]
    if (email) {
      sendEmail({ to: email, subject, html })
    }

    sent++
  }

  return NextResponse.json({ sent })
}
