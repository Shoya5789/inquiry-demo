import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

function hash(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex')
}

async function main() {
  console.log('🌱 Seeding...')

  // ── Users（upsert → 重複投入セーフ）──────────────────────────
  const adminPw = await bcrypt.hash(process.env.STAFF_ADMIN_PASSWORD ?? 'admin123', 10)
  const staffPw = await bcrypt.hash(process.env.STAFF_STAFF_PASSWORD ?? 'staff123', 10)

  const admin = await prisma.user.upsert({
    where: { username: 'admin1' },
    update: {},
    create: { username: 'admin1', passwordHash: adminPw, dept: '総務課', role: 'admin' },
  })

  const staff = await prisma.user.upsert({
    where: { username: 'staff1' },
    update: {},
    create: { username: 'staff1', passwordHash: staffPw, dept: '環境課', role: 'staff' },
  })

  console.log('✅ Users ready')

  // ── KnowledgeSources（既存があればスキップ）───────────────────
  const ksCount = await prisma.knowledgeSource.count()
  if (ksCount > 0) {
    console.log(`⏭️  KnowledgeSources already seeded (${ksCount} rows), skipping`)
  } else {
    const ksSources = [
      {
        type: 'text',
        name: 'ゴミ収集・分別ガイド',
        content: `可燃ゴミは毎週火曜・金曜に収集します。ゴミ袋は指定の黄色い袋をご使用ください。
生ゴミ・紙類・布類は可燃ゴミです。プラスチック製容器包装は毎週水曜日に分別収集します。
収集時間は午前8時までに指定場所に出してください。ゴミ袋に氏名の記載は不要です。`,
      },
      {
        type: 'text',
        name: '粗大ごみ申込案内',
        content: `粗大ごみ（30cm以上の大型ごみ）は事前申込制です。
申込方法：電話0120-XXX-XXX（月〜土 8:30〜17:00）またはオンライン申込フォーム。
収集日は申込から約2週間後。処理手数料は品目により200円〜2,000円。
自己搬入の場合はクリーンセンター（市内〇〇町）へ。月〜土 9:00〜16:00受付。`,
      },
      {
        type: 'text',
        name: '道路補修申請手順',
        content: `道路の陥没・穴・ひび割れなどの損傷を発見した場合は道路管理課へご連絡ください。
連絡先：道路管理課 TEL: 0XX-XXXX-XXXX / メール: douro@city.example.jp
現場の写真と住所（または地図情報）を添えてご連絡いただくと対応がスムーズです。
緊急の場合（通行不能・危険な状態）は24時間対応の緊急窓口へ: 0XX-XXXX-YYYY
通常の補修工事は受付から2〜4週間程度で対応します。`,
      },
      {
        type: 'text',
        name: '年金住所変更手続き',
        content: `年金受給者が住所変更した場合、日本年金機構への届出が必要です。
手続き先：市役所市民課または年金事務所
必要書類：年金証書、本人確認書類（マイナンバーカード等）、印鑑
マイナンバーカードをお持ちの方はワンストップ特例で市役所でのみ手続き可能。
郵送手続き：「住所変更届」を最寄りの年金事務所へ郵送。
オンライン：マイナポータルからも手続きが可能です。`,
      },
      {
        type: 'text',
        name: '市民イベント申込案内',
        content: `市主催のイベント・講座への参加申込方法についてご案内します。
申込方法：（1）オンライン申込（市ホームページ）（2）電話申込（3）窓口申込
申込受付は各イベント開催の2週間前から開始。
定員に達した場合は抽選となります。抽選結果は締切後1週間以内にお知らせします。
キャンセルの場合は開催3日前までにご連絡ください。
お問い合わせ：市民活動推進課 TEL: 0XX-XXXX-ZZZZ`,
      },
    ]

    for (const ks of ksSources) {
      await prisma.knowledgeSource.create({
        data: { ...ks, contentHash: hash(ks.content), uri: '' },
      })
    }
    console.log('✅ KnowledgeSources created')
  }

  // ── Inquiries（既存があればスキップ）──────────────────────────
  const inqCount = await prisma.inquiry.count()
  if (inqCount > 0) {
    console.log(`⏭️  Inquiries already seeded (${inqCount} rows), skipping`)
    console.log('🎉 Seed complete!')
    return
  }

  const inquiriesData = [
    {
      channel: 'web',
      rawText: '燃えるゴミはいつ出せばいいですか？収集日を教えてください。',
      normalizedText: '燃えるゴミはいつ出せばいいですか？収集日を教えてください。',
      aiSummary: 'ゴミ収集日に関する問い合わせ。可燃ゴミの収集スケジュールを確認したい。',
      urgency: 'LOW',
      importance: 'LOW',
      deptSuggested: '環境課',
      deptActual: '環境課',
      status: 'ANSWERED',
      tags: JSON.stringify(['ゴミ', '収集日']),
      isRead: true,
    },
    {
      channel: 'web',
      rawText: '近所の道路が陥没していて危ないです。車が通れなくなっています。早急に対応してください。',
      normalizedText: '近所の道路が陥没していて危ないです。車が通れなくなっています。早急に対応してください。',
      aiSummary: '道路陥没の緊急通報。通行不能のため早急な対応が必要。',
      urgency: 'HIGH',
      importance: 'HIGH',
      deptSuggested: '道路管理課',
      deptActual: '道路管理課',
      status: 'IN_PROGRESS',
      tags: JSON.stringify(['道路', '緊急', '陥没']),
      needsReply: true,
      contactName: '山田太郎',
      contactEmail: 'yamada@example.com',
      addressText: '市内〇〇町3丁目5番地',
      lat: 35.6812,
      lng: 139.7671,
      isRead: true,
    },
    {
      channel: 'email',
      rawText: '年金の住所変更をしたいのですが、どこで手続きできますか？必要書類も教えてください。',
      normalizedText: '年金の住所変更をしたいのですが、どこで手続きできますか？必要書類も教えてください。',
      aiSummary: '年金住所変更手続きに関する問い合わせ。必要書類と手続き場所を確認したい。',
      urgency: 'MED',
      importance: 'MED',
      deptSuggested: '市民課',
      deptActual: '市民課',
      status: 'ANSWERED',
      tags: JSON.stringify(['年金', '住所変更', '手続き']),
      isRead: true,
    },
    {
      channel: 'web',
      rawText: '公園で喫煙している人がいます。子供が遊んでいるので困っています。禁煙にしてほしい。',
      normalizedText: '公園で喫煙している人がいます。子供が遊んでいるので困っています。禁煙にしてほしい。',
      aiSummary: '公園での喫煙に関する苦情。禁煙化を要望している。',
      urgency: 'MED',
      importance: 'MED',
      deptSuggested: '公園管理課',
      deptActual: '',
      tags: JSON.stringify(['公園', '喫煙', '苦情']),
      needsReply: true,
      contactName: '鈴木花子',
      contactEmail: 'suzuki@example.com',
      addressText: '中央公園',
      lat: 35.6895,
      lng: 139.6917,
      isRead: false,
    },
    {
      channel: 'web',
      rawText: '市民向けのイベントに参加したいのですが、申込方法を教えてください。',
      normalizedText: '市民向けのイベントに参加したいのですが、申込方法を教えてください。',
      aiSummary: '市民イベントの申込方法に関する問い合わせ。',
      urgency: 'LOW',
      importance: 'LOW',
      deptSuggested: '市民活動推進課',
      deptActual: '',
      tags: JSON.stringify(['イベント', '申込']),
      isRead: false,
    },
    {
      channel: 'web',
      rawText: '冷蔵庫を処分したいのですが、粗大ごみとして出せますか？費用はいくらですか？',
      normalizedText: '冷蔵庫を処分したいのですが、粗大ごみとして出せますか？費用はいくらですか？',
      aiSummary: '冷蔵庫の粗大ごみ処分に関する問い合わせ。費用と方法を確認したい。',
      urgency: 'LOW',
      importance: 'LOW',
      deptSuggested: '環境課',
      deptActual: '',
      tags: JSON.stringify(['粗大ごみ', '冷蔵庫', '処分']),
      isRead: false,
    },
    {
      channel: 'phone',
      rawText: '夜中に近所で騒音がひどく、眠れません。何とかしてもらえませんか。',
      normalizedText: '夜中に近所で騒音がひどく、眠れません。何とかしてもらえませんか。',
      aiSummary: '夜間騒音に関する苦情。生活妨害として対応が必要。',
      urgency: 'MED',
      importance: 'MED',
      deptSuggested: '生活安全課',
      deptActual: '',
      tags: JSON.stringify(['騒音', '苦情', '夜間']),
      needsReply: true,
      contactPhone: '090-XXXX-XXXX',
      addressText: '〇〇町1丁目',
      lat: 35.6762,
      lng: 139.6503,
      isRead: true,
    },
    {
      channel: 'web',
      rawText: '交差点の信号機が壊れていて点滅しています。場所は〇〇町2丁目の国道沿いです。',
      normalizedText: '交差点の信号機が壊れていて点滅しています。場所は〇〇町2丁目の国道沿いです。',
      aiSummary: '交通信号機の故障通報。交通安全上の緊急対応が必要。',
      urgency: 'HIGH',
      importance: 'HIGH',
      deptSuggested: '道路管理課',
      deptActual: '',
      tags: JSON.stringify(['信号機', '故障', '緊急', '道路']),
      addressText: '〇〇町2丁目国道沿い',
      lat: 35.6723,
      lng: 139.7016,
      isRead: false,
    },
    {
      channel: 'web',
      rawText: '子育て支援センターの利用方法を教えてください。何歳まで利用できますか？',
      normalizedText: '子育て支援センターの利用方法を教えてください。何歳まで利用できますか？',
      aiSummary: '子育て支援センターの利用方法に関する問い合わせ。対象年齢と利用手順を確認したい。',
      urgency: 'LOW',
      importance: 'MED',
      deptSuggested: '子育て支援課',
      deptActual: '',
      tags: JSON.stringify(['子育て', '支援センター']),
      needsReply: true,
      contactEmail: 'parent@example.com',
      isRead: false,
    },
    {
      channel: 'web',
      rawText: '道路の水道管が破裂して道路が水浸しになっています！至急対応をお願いします。',
      normalizedText: '道路の水道管が破裂して道路が水浸しになっています！至急対応をお願いします。',
      aiSummary: '水道管破裂による道路冠水の緊急通報。即時対応が必要。',
      urgency: 'HIGH',
      importance: 'HIGH',
      deptSuggested: '上下水道課',
      deptActual: '',
      tags: JSON.stringify(['水道', '緊急', '破裂', '道路']),
      needsReply: true,
      contactPhone: '080-XXXX-YYYY',
      addressText: '〇〇町5丁目駅前通り',
      lat: 35.6851,
      lng: 139.7102,
      isRead: false,
    },
  ]

  const createdInquiries: { id: string }[] = []
  for (const inq of inquiriesData) {
    // deptActual が空なら deptSuggested を使う
    const data = {
      ...inq,
      deptActual: (inq as { deptActual?: string }).deptActual || inq.deptSuggested,
    }
    const created = await prisma.inquiry.create({
      data: data as Parameters<typeof prisma.inquiry.create>[0]['data'],
    })
    createdInquiries.push(created)
  }
  console.log('✅ Inquiries created')

  // ── Answers ────────────────────────────────────────────────────
  await prisma.answer.create({
    data: {
      inquiryId: createdInquiries[0].id,
      draftAnswerText:
        '可燃ゴミの収集日は毎週火曜日と金曜日です。収集時間は午前8時までにお出しください。指定の黄色いゴミ袋をご利用ください。',
      draftPolicyJson: JSON.stringify({
        conclusion: '収集スケジュールを案内する',
        reasoning: '市のゴミ収集ガイドに基づく回答',
        missingInfo: [],
        cautions: ['収集場所は地域によって異なる場合があります'],
        nextActions: [],
      }),
      sourcesJson: JSON.stringify([
        { sourceId: 'ks-1', type: 'text', title: 'ゴミ収集・分別ガイド', snippet: '可燃ゴミは毎週火曜・金曜' },
      ]),
      finalAnswerText:
        '可燃ゴミの収集日は毎週火曜日と金曜日です。収集時間は午前8時までにお出しください。指定の黄色いゴミ袋をご利用いただく必要があります。詳しくはゴミ収集・分別ガイドをご参照ください。',
      approvedByUserId: admin.id,
      approvedAt: new Date(),
      sentChannel: 'none',
    },
  })

  const ans2 = await prisma.answer.create({
    data: {
      inquiryId: createdInquiries[2].id,
      draftAnswerText:
        '年金の住所変更手続きは市役所市民課または最寄りの年金事務所で行えます。必要書類は年金証書・本人確認書類（マイナンバーカード等）・印鑑です。',
      draftPolicyJson: JSON.stringify({
        conclusion: '年金住所変更の手続き方法を案内する',
        reasoning: '年金住所変更に関する標準的な案内',
        missingInfo: [],
        cautions: ['マイナンバーカードの有無で手続き先が変わる場合があります'],
        nextActions: ['市役所市民課へ来庁を案内'],
      }),
      sourcesJson: JSON.stringify([
        { sourceId: 'ks-4', type: 'text', title: '年金住所変更手続き', snippet: '市役所市民課または年金事務所' },
      ]),
      finalAnswerText:
        '年金の住所変更手続きは以下の方法で行えます。\n\n【手続き場所】市役所市民課（1F）または最寄りの年金事務所\n\n【必要書類】\n・年金証書\n・本人確認書類（マイナンバーカード、運転免許証等）\n・印鑑\n\nマイナンバーカードをお持ちの場合は市役所のみでの手続きが可能です。\n\nご不明な点がございましたら市民課（内線XXX）までお問い合わせください。',
      approvedByUserId: staff.id,
      approvedAt: new Date(),
      sentChannel: 'email',
      sentAt: new Date(),
    },
  })

  await prisma.inquiry.update({ where: { id: createdInquiries[0].id }, data: { status: 'ANSWERED' } })
  await prisma.inquiry.update({ where: { id: createdInquiries[2].id }, data: { status: 'ANSWERED' } })

  console.log('✅ Answers created')

  // ── AuditLogs ──────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        actorUserId: admin.id,
        action: 'APPROVE_ANSWER',
        targetType: 'Answer',
        targetId: ans2.id,
        metaJson: JSON.stringify({ inquiryId: createdInquiries[0].id }),
      },
      {
        actorUserId: staff.id,
        action: 'APPROVE_ANSWER',
        targetType: 'Answer',
        targetId: ans2.id,
        metaJson: JSON.stringify({ inquiryId: createdInquiries[2].id }),
      },
      {
        actorUserId: staff.id,
        action: 'SEND_ANSWER',
        targetType: 'Answer',
        targetId: ans2.id,
        metaJson: JSON.stringify({ channel: 'email', inquiryId: createdInquiries[2].id }),
      },
    ],
  })

  console.log('✅ AuditLogs created')
  console.log('🎉 Seed complete!')
  console.log('\nLogin credentials:')
  console.log('  admin1 / admin123 (管理者・総務課)')
  console.log('  staff1 / staff123 (職員・環境課)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
