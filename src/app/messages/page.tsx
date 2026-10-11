import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/security";
import { listConversations } from "@/lib/conversations";
import { ConversationList } from "@/components/conversation-list";
import { NewMessage } from "@/components/chat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function Messages() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");
  const items = await listConversations(user.id);
  return (
    <div className="page" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) 1fr", gap: 16, height: "100dvh", paddingTop: 20 }}>
      <div className="card scroll-thin" style={{ overflowY: "auto", padding: 6 }}>
        <div className="row between" style={{ padding: "10px 12px" }}><b style={{ fontSize: 20 }}>Messages</b><NewMessage /></div>
        <ConversationList items={items} />
      </div>
      <div className="card hide-mobile" style={{ display: "grid", placeItems: "center", textAlign: "center" }}>
        <div><div className="logo-mark" style={{ width: 70, height: 70, margin: "0 auto 12px" }}><MessageCircle /></div><b style={{ fontSize: 20 }}>Your messages</b><p className="muted">Send private messages, photos and videos to friends.</p></div>
      </div>
    </div>
  );
}
