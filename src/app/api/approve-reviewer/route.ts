// 리뷰어 승인 API
// POST { campaignReviewerId } — 상태 변경 + 승인 이메일 발송
// 클라이언트에서 직접 DB를 건드리면 API 키가 노출되므로 서버에서 처리
// service_role 사용
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'
import { reviewerApprovedEmail } from '@/lib/email-templates'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const { campaignReviewerId } = await request.json()

  if (!campaignReviewerId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 1. campaign_reviewers 상태를 'accepted'로 변경
  const { data: reviewer, error: updateError } = await supabase
    .from('campaign_reviewers')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', campaignReviewerId)
    .select('id, reviewer_id, campaign_id, access_token')
    .single()

  if (updateError || !reviewer) {
    return NextResponse.json(
      { error: updateError?.message ?? '리뷰어를 찾을 수 없습니다' },
      { status: 500 }
    )
  }

  // 2. 캠페인 제목 조회
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('title')
    .eq('id', reviewer.campaign_id)
    .single()

  // 3. 리뷰어 이메일 조회
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', reviewer.reviewer_id)
    .single()

  // 4. 승인 이메일 발송 (fire-and-forget — 실패해도 승인 자체는 완료)
  if (campaign?.title && profile?.email && reviewer.access_token) {
    // 웹뷰어 링크: /v?token=접근토큰
    const viewerLink = `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/v?token=${reviewer.access_token}`
    const { subject, html } = reviewerApprovedEmail(campaign.title, viewerLink)
    sendEmail({ to: profile.email, subject, html })
  }

  return NextResponse.json({ approved: true })
}
