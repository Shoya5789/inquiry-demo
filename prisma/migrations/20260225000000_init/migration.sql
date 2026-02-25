-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "dept" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL DEFAULT 'web',
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "aiSummary" TEXT NOT NULL DEFAULT '',
    "urgency" TEXT NOT NULL DEFAULT 'MED',
    "importance" TEXT NOT NULL DEFAULT 'MED',
    "deptSuggested" TEXT NOT NULL DEFAULT '',
    "deptActual" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "followupQAJson" TEXT NOT NULL DEFAULT '[]',
    "needsReply" BOOLEAN NOT NULL DEFAULT false,
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "addressText" TEXT NOT NULL DEFAULT '',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "locale" TEXT NOT NULL DEFAULT 'ja',
    "isRead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "draftPolicyJson" TEXT NOT NULL DEFAULT '{}',
    "draftAnswerText" TEXT NOT NULL DEFAULT '',
    "draftSupplementalText" TEXT NOT NULL DEFAULT '',
    "sourcesJson" TEXT NOT NULL DEFAULT '[]',
    "finalAnswerText" TEXT NOT NULL DEFAULT '',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentChannel" TEXT NOT NULL DEFAULT 'none',
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uri" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metaJson" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
