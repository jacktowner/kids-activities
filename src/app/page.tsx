import { cookies } from "next/headers";
import { ExplorePage } from "@/components/ExplorePage";
import { USER_SESSION_COOKIE, getSessionUser } from "@/lib/user-auth";

export default async function Home() {
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get(USER_SESSION_COOKIE)?.value);
  return <ExplorePage isLoggedIn={Boolean(user)} />;
}
