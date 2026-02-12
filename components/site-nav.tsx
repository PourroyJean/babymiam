import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { ProfileMenu } from "@/components/profile-menu";
import type { ChildProfile } from "@/lib/types";

type SiteNavProps = {
  activePage: "suivi" | "blog";
  childProfile: ChildProfile | null;
};

function getLinkClassName(isActive: boolean) {
  return isActive ? "site-nav-link is-active" : "site-nav-link";
}

export function SiteNav({ activePage, childProfile }: SiteNavProps) {
  return (
    <header className="site-nav">
      <div className="site-nav-main">
        <Link href="/" className="site-brand" aria-label="Aller à l'accueil Babymiam">
          <span className="site-logo" aria-hidden="true">
            🐯
          </span>
          <span className="site-brand-text">Babymiam</span>
        </Link>

        <nav className="site-nav-links" aria-label="Navigation principale">
          <Link
            href="/"
            className={getLinkClassName(activePage === "suivi")}
            aria-current={activePage === "suivi" ? "page" : undefined}
          >
            Suivi
          </Link>
          <Link
            href="/blog"
            className={getLinkClassName(activePage === "blog")}
            aria-current={activePage === "blog" ? "page" : undefined}
          >
            Blog
          </Link>
        </nav>
      </div>

      <div className="site-account-actions">
        <ProfileMenu initialProfile={childProfile} />
        <form action={logoutAction}>
          <button type="submit" className="logout-btn">
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}
