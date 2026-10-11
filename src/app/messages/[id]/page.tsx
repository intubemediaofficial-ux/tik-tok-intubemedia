import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/security";
import { listConversations } from "@/lib/conversations";
import { ConversationList } from "@/components/conversation-list";
import { Chat } from "@/components/chat";
import { publicUserSelect } from "@/lib/user-dto";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat" };

export default async function Thread({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/messages/${id}`);
  const member = await db.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: id, userId: user.id } } });
  if (!member) notFound();
  const others = await db.conversationMember.findMany({ where: { conversationId: id, userId: { not: user.id } }, include: { user: { select: publicUserSelect } } });
  const items = await listConversations(user.id);
  const other = others[0]?.user;
  if (!other) notFound();
  return (
    <div className="page" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) 1fr", gap: 16, height: "100dvh", paddingTop: 20 }}>
      <div className="card scroll-thin hide-mobile" style={{ overflowY: "auto", padding: 6 }}>
        <div style={{ padding: "10px 12px" }}><b style={{ fontSize: 20 }}>Messages</b></div>
        <ConversationList items={items} active={id} />
      </div>
      <Chat conversationId={id} me={user.id} other={other} otherLastRead={others[0].lastReadAt.toISOString()} />
    </div>
  );
}
