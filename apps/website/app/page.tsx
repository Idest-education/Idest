import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/navbar-content";
import ClassShowcaseClient from "@/components/class/ClassShowcaseClient";
import AssignmentShowcaseClient from "@/components/assignment/AssignmentShowcaseClient";
import SiteFooter from "@/components/site-footer";
import LandingRoot from "./_components/LandingRoot";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (user) {
    return (
      <main className="min-h-screen bg-white">
        <Navbar />
        <ClassShowcaseClient />
        <AssignmentShowcaseClient />
        <SiteFooter />
      </main>
    );
  }

  return <LandingRoot />;
}

