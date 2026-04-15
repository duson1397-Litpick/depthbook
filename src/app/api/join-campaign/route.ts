// 캠페인 참여 API
// 두 가지 방식 지원:
//   1. 초대 링크 방식 — { inviteToken, reviewerId } → 자동 승인 (status: 'accepted')
//   2. 직접 신청 방식 — { campaignId, reviewerId } → 승인 대기 (status: 'pending')
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET ?invite=xxx&reviewerId=yyy
// → 캠페인 정보 + 이미 참여 중인지 여부 + 기존 access_token 반환
export async function GET(request: NextRequest) {
  const invite = request.nextUrl.searchParams.get('invite')
  const reviewerId = request.nextUrl.searchParams.get('reviewerId')

  if (!invite || !reviewerId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 리뷰어 계정 여부 확인 — publisher 계정이 접근하면 차단
  const { data: reviewerProfile } = await supabase
    .from('reviewer_profiles')
    .select('id')
    .eq('id', reviewerId)
    .single()

  if (!reviewerProfile) {
    return NextResponse.json({ error: '리뷰어 계정이 아닙니다' }, { status: 400 })
  }

  // invite_token으로 캠페인 조회
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, title, author, genre, description, status, max_reviewers, sample_ratio')
    .eq('invite_token', invite)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: '잘못된 초대 링크입니다' }, { status: 404 })
  }

  if (campaign.status !== 'recruiting' && campaign.status !== 'active') {
    return NextResponse.json({ error: '현재 리뷰어를 모집하지 않는 캠페인입니다' }, { status: 403 })
  }

  // 현재 참여 인원 수 확인 (accepted 이상인 행)
  const { count: currentCount } = await supabase
    .from('campaign_reviewers')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .in('status', ['accepted', 'reading', 'completed'])

  if ((currentCount ?? 0) >= campaign.max_reviewers) {
    return NextResponse.json({ error: '모집이 마감되었습니다' }, { status: 409 })
  }

  // 이미 참여 중인지 확인
  const { data: existing } = await supabase
    .from('campaign_reviewers')
    .select('id, status, access_token')
    .eq('campaign_id', campaign.id)
    .eq('reviewer_id', reviewerId)
    .single()

  return NextResponse.json({
    campaign,
    alreadyJoined: !!existing,
    existingStatus: existing?.status ?? null,
    existingAccessToken: existing?.access_token ?? null,
  })
}

// POST — 두 가지 방식 처리
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { inviteToken, campaignId, reviewerId } = body

  // reviewerId는 두 방식 모두 필수
  if (!reviewerId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 리뷰어 계정 여부 확인 — publisher 계정이 접근하면 차단
  const { data: reviewerProfile } = await supabase
    .from('reviewer_profiles')
    .select('id')
    .eq('id', reviewerId)
    .single()

  if (!reviewerProfile) {
    return NextResponse.json({ error: '리뷰어 계정이 아닙니다' }, { status: 400 })
  }

  // 어느 방식인지 판단
  const isInviteMode = !!inviteToken
  const isApplyMode = !!campaignId

  if (!isInviteMode && !isApplyMode) {
    return NextResponse.json({ error: 'inviteToken 또는 campaignId가 필요합니다' }, { status: 400 })
  }

  // ── 초대 링크 방식 ──────────────────────────────
  if (isInviteMode) {
    // invite_token으로 캠페인 조회
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, status, max_reviewers')
      .eq('invite_token', inviteToken)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: '잘못된 초대 링크입니다' }, { status: 404 })
    }

    if (campaign.status !== 'recruiting' && campaign.status !== 'active') {
      return NextResponse.json({ error: '현재 리뷰어를 모집하지 않는 캠페인입니다' }, { status: 403 })
    }

    // 현재 참여 인원 수 재확인 (동시 요청 방어)
    const { count: currentCount } = await supabase
      .from('campaign_reviewers')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .in('status', ['accepted', 'reading', 'completed'])

    if ((currentCount ?? 0) >= campaign.max_reviewers) {
      return NextResponse.json({ error: '모집이 마감되었습니다' }, { status: 409 })
    }

    // 이미 참여 중인지 재확인
    const { data: existing } = await supabase
      .from('campaign_reviewers')
      .select('id, access_token')
      .eq('campaign_id', campaign.id)
      .eq('reviewer_id', reviewerId)
      .single()

    if (existing) {
      return NextResponse.json({ accessToken: existing.access_token })
    }

    // access_token 생성 후 자동 승인으로 INSERT
    const accessToken = crypto.randomUUID()

    const { error } = await supabase
      .from('campaign_reviewers')
      .insert({
        campaign_id: campaign.id,
        reviewer_id: reviewerId,
        source: 'invited',
        status: 'accepted',
        access_token: accessToken,
        accepted_at: new Date().toISOString(),
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ accessToken })
  }

  // ── 직접 신청 방식 ──────────────────────────────
  // campaignId로 캠페인 직접 조회
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, status, max_reviewers')
    .eq('id', campaignId)
    .single()

  if (!campaign) {
    return NextResponse.json({ error: '캠페인을 찾을 수 없습니다' }, { status: 404 })
  }

  if (campaign.status !== 'recruiting') {
    return NextResponse.json({ error: '현재 리뷰어를 모집하지 않는 캠페인입니다' }, { status: 403 })
  }

  // 현재 참여 인원 수 확인
  const { count: currentCount } = await supabase
    .from('campaign_reviewers')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .in('status', ['accepted', 'reading', 'completed'])

  if ((currentCount ?? 0) >= campaign.max_reviewers) {
    return NextResponse.json({ error: '모집이 마감되었습니다' }, { status: 409 })
  }

  // 이미 신청했거나 참여 중인지 확인
  const { data: existing } = await supabase
    .from('campaign_reviewers')
    .select('id, status')
    .eq('campaign_id', campaign.id)
    .eq('reviewer_id', reviewerId)
    .single()

  if (existing) {
    return NextResponse.json({ error: '이미 신청했거나 참여 중인 캠페인입니다' }, { status: 409 })
  }

  // 승인 대기 상태로 INSERT (access_token은 아직 생성하지 않음)
  const { error } = await supabase
    .from('campaign_reviewers')
    .insert({
      campaign_id: campaign.id,
      reviewer_id: reviewerId,
      source: 'applied',
      status: 'pending',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'pending' })
}
