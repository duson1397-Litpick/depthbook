// 출간 알림 발송 API
// POST { campaignId } — 읽고 싶다 등록 독자들에게 출간 알림 전송
// service_role 사용
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createNotification } from '@/lib/notify'

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

  // 3. 각 유저에게 알림 생성
  const title = campaign.title ?? '관심 도서'
  let sent = 0

  for (const { user_id } of wtrUsers) {
    await createNotification({
      userId: user_id,
      type: 'book_published',
      referenceId: campaignId,
      referenceType: 'campaign',
      message: `관심 등록하신 "${title}"이(가) 출간되었습니다!`,
    })
    sent++
  }

  return NextResponse.json({ sent })
}
